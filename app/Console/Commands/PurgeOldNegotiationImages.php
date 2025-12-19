<?php

namespace App\Console\Commands;

use App\Models\Negotiation;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class PurgeOldNegotiationImages extends Command
{
    protected $signature = 'negotiations:purge-old-images {--days=5 : Days after delivered to purge} {--dry-run : Do not delete, only report}';

    protected $description = 'Delete stored negotiation images after N days from delivery (delivered_at) and null out photo columns.';

    public function handle(): int
    {
        $days = max(0, (int) $this->option('days'));
        $dryRun = (bool) $this->option('dry-run');

        $cutoff = now()->subDays($days);
        $disk = Storage::disk('public');

        $query = Negotiation::query()
            ->where('status', 'delivered')
            ->whereNotNull('delivered_at')
            ->where('delivered_at', '<=', $cutoff)
            ->where(function ($q) {
                $q->whereNotNull('product_photos')
                    ->orWhereNotNull('intermediary_photos');
            })
            ->orderBy('delivered_at');

        $total = (clone $query)->count();
        if ($total === 0) {
            $this->info('No negotiations eligible for purge.');
            return self::SUCCESS;
        }

        $this->info(sprintf('Eligible negotiations: %d (cutoff: %s, dry-run: %s)', $total, $cutoff->toDateTimeString(), $dryRun ? 'yes' : 'no'));

        $processed = 0;
        $deletedFiles = 0;
        $updatedRows = 0;

        $query->chunkById(100, function ($items) use ($disk, $dryRun, &$processed, &$deletedFiles, &$updatedRows) {
            foreach ($items as $negotiation) {
                $processed += 1;

                $productPaths = is_array($negotiation->product_photos) ? $negotiation->product_photos : [];
                $inspectionPaths = is_array($negotiation->intermediary_photos) ? $negotiation->intermediary_photos : [];
                $allPaths = array_values(array_unique(array_filter(array_merge($productPaths, $inspectionPaths), function ($p) {
                    return is_string($p) && $p !== '';
                })));

                if (empty($allPaths)) {
                    if (! $dryRun) {
                        $negotiation->update([
                            'product_photos' => null,
                            'intermediary_photos' => null,
                        ]);
                        $updatedRows += 1;
                    }
                    continue;
                }

                $deletedThisNegotiation = 0;
                foreach ($allPaths as $path) {
                    try {
                        if ($disk->exists($path)) {
                            if (! $dryRun && $disk->delete($path)) {
                                $deletedThisNegotiation += 1;
                            }
                        }
                    } catch (\Throwable $e) {
                        // continue purging other files
                    }
                }

                if (! $dryRun) {
                    $negotiation->update([
                        'product_photos' => null,
                        'intermediary_photos' => null,
                    ]);
                    $updatedRows += 1;
                }

                $deletedFiles += $deletedThisNegotiation;
            }
        });

        $this->info(sprintf('Processed: %d | Files deleted: %d | Rows updated: %d', $processed, $deletedFiles, $updatedRows));

        return self::SUCCESS;
    }
}
