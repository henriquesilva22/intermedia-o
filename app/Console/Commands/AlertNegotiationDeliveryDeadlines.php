<?php

namespace App\Console\Commands;

use App\Models\Negotiation;
use App\Notifications\NegotiationDeliveryDeadlineNotification;
use App\Services\BrevoSmsService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

class AlertNegotiationDeliveryDeadlines extends Command
{
    protected $signature = 'negotiations:alert-delivery-deadlines {--dry-run : Do not notify, only report} {--now= : Override current time (ISO-8601)}';

    protected $description = 'Alert sellers when a digital delivery is close to deadline or overdue (based on delivery_days).';

    public function __construct(private readonly BrevoSmsService $brevoSms)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $now = $this->resolveNow();

        $query = Negotiation::query()
            ->with(['seller'])
            ->with(['buyer'])
            ->where('status', 'waiting_digital_delivery')
            ->whereNotNull('paid_at')
            ->orderBy('paid_at');

        $total = (clone $query)->count();
        if ($total === 0) {
            $this->info('No negotiations eligible for delivery deadline alerts.');
            return self::SUCCESS;
        }

        $this->info(sprintf('Eligible negotiations: %d | now=%s | dry-run=%s', $total, $now->toIso8601String(), $dryRun ? 'yes' : 'no'));

        $processed = 0;
        $notifiedDueSoon = 0;
        $notifiedOverdue = 0;

        $query->chunkById(100, function ($items) use ($dryRun, $now, &$processed, &$notifiedDueSoon, &$notifiedOverdue) {
            foreach ($items as $negotiation) {
                $processed += 1;

                $category = (string) $negotiation->category;
                $deadlineAt = $this->computeDeadlineAt($negotiation, $now);
                if (! $deadlineAt) {
                    continue;
                }

                $dueSoon = $now->greaterThanOrEqualTo($deadlineAt->copy()->subHours(24)) && $now->lessThan($deadlineAt);
                $overdue = $now->greaterThanOrEqualTo($deadlineAt);

                if ($overdue) {
                    if ($negotiation->digital_delivery_overdue_alerted_at) {
                        // seller already alerted; still allow buyer alert if missing
                    } else {
                        $this->line(sprintf('OVERDUE  #%d | %s | deadline=%s', $negotiation->id, $category, $deadlineAt->toIso8601String()));
                        if (! $dryRun) {
                            $this->notifySeller($negotiation, 'overdue', $deadlineAt);
                            $negotiation->forceFill(['digital_delivery_overdue_alerted_at' => $now])->save();
                        }
                        $notifiedOverdue += 1;
                    }

                    if (! $negotiation->digital_delivery_overdue_buyer_alerted_at) {
                        $this->line(sprintf('BUYER ALERT #%d | overdue | deadline=%s', $negotiation->id, $deadlineAt->toIso8601String()));
                        if (! $dryRun) {
                            $this->notifyBuyer($negotiation, 'overdue', $deadlineAt);
                            $negotiation->forceFill(['digital_delivery_overdue_buyer_alerted_at' => $now])->save();
                        }
                    }
                    continue;
                }

                if ($dueSoon) {
                    if ($negotiation->digital_delivery_due_soon_alerted_at) {
                        continue;
                    }

                    $this->line(sprintf('DUE SOON #%d | %s | deadline=%s', $negotiation->id, $category, $deadlineAt->toIso8601String()));
                    if (! $dryRun) {
                        $this->notifySeller($negotiation, 'due_soon', $deadlineAt);
                        $negotiation->forceFill(['digital_delivery_due_soon_alerted_at' => $now])->save();
                    }
                    $notifiedDueSoon += 1;
                }
            }
        });

        $this->info(sprintf('Processed: %d | Due soon notified: %d | Overdue notified: %d', $processed, $notifiedDueSoon, $notifiedOverdue));

        return self::SUCCESS;
    }

    private function resolveNow(): Carbon
    {
        $raw = $this->option('now');
        if (is_string($raw) && trim($raw) !== '') {
            try {
                return Carbon::parse($raw);
            } catch (\Throwable $e) {
                $this->warn('Invalid --now value; falling back to now().');
            }
        }

        return now();
    }

    private function isGameAccountCategory(string $category): bool
    {
        return trim($category) === 'Conta de jogo';
    }

    private function isDeadlineDrivenDigitalCategory(string $category): bool
    {
        $c = trim($category);
        return in_array($c, [
            'Conta de jogo',
            'Chave de jogo / DLC',
            'Serviço (boosting / rank / leveling)',
            'Troca de serviço',
        ], true);
    }

    private function computeDeadlineAt(Negotiation $negotiation, Carbon $now): ?Carbon
    {
        $paidAt = $negotiation->paid_at;
        if (! $paidAt) {
            return null;
        }

        $category = (string) $negotiation->category;

        if ($this->isGameAccountCategory($category)) {
            return $paidAt->copy()->addWeekdays(3);
        }

        if (! $this->isDeadlineDrivenDigitalCategory($category)) {
            // For categories like currency, the business rules may not use delivery_days.
            return null;
        }

        $days = (int) ($negotiation->delivery_days ?? 0);
        if ($days <= 0) {
            return null;
        }

        // calendar days
        return $paidAt->copy()->addDays($days);
    }

    private function notifySeller(Negotiation $negotiation, string $type, Carbon $deadlineAt): void
    {
        try {
            $seller = $negotiation->seller;
            if (! $seller) {
                return;
            }

            $seller->notify(new NegotiationDeliveryDeadlineNotification(
                negotiationId: (int) $negotiation->id,
                title: (string) ($negotiation->title ?? ''),
                category: (string) ($negotiation->category ?? ''),
                type: $type === 'overdue' ? 'overdue' : 'due_soon',
                audience: 'seller',
                deadlineAtIso8601: $deadlineAt->toIso8601String(),
            ));

            if ($type === 'overdue' && $seller->phone) {
                $message = sprintf(
                    'Intermediacao Pro: entrega digital atrasada na negociacao #%d. Conclua a entrega o quanto antes.',
                    (int) $negotiation->id
                );
                $this->brevoSms->sendMessage((string) $seller->phone, $message);
            }
        } catch (\Throwable $e) {
            Log::error('Failed to notify seller about delivery deadline.', [
                'negotiation_id' => $negotiation->id,
                'type' => $type,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function notifyBuyer(Negotiation $negotiation, string $type, Carbon $deadlineAt): void
    {
        try {
            $buyer = $negotiation->buyer;
            if (! $buyer) {
                return;
            }

            $buyer->notify(new NegotiationDeliveryDeadlineNotification(
                negotiationId: (int) $negotiation->id,
                title: (string) ($negotiation->title ?? ''),
                category: (string) ($negotiation->category ?? ''),
                type: $type === 'overdue' ? 'overdue' : 'due_soon',
                audience: 'buyer',
                deadlineAtIso8601: $deadlineAt->toIso8601String(),
            ));
        } catch (\Throwable $e) {
            Log::error('Failed to notify buyer about delivery deadline.', [
                'negotiation_id' => $negotiation->id,
                'type' => $type,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
