<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class NegotiationDeliveryDeadlineNotification extends Notification
{
    use Queueable;

    public function __construct(
        private readonly int $negotiationId,
        private readonly string $title,
        private readonly string $category,
        private readonly string $type,
        private readonly string $audience,
        private readonly ?string $deadlineAtIso8601,
    ) {
    }

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $subject = $this->type === 'overdue'
            ? 'Entrega digital atrasada'
            : 'Entrega digital perto do prazo';

        $deadlineLine = $this->deadlineAtIso8601
            ? 'Prazo: ' . $this->deadlineAtIso8601
            : null;

        $message = (new MailMessage())
            ->subject($subject)
            ->greeting('Olá!')
            ->line('Negociação #' . $this->negotiationId)
            ->line('Título: ' . $this->title)
            ->line('Categoria: ' . $this->category);

        if ($deadlineLine) {
            $message->line($deadlineLine);
        }

        if ($this->type === 'overdue') {
            if ($this->audience === 'buyer') {
                $message->line('O prazo de entrega digital expirou. Caso ainda não tenha recebido a entrega, a intermediadora pode intervir.');
            } else {
                $message->line('O prazo de entrega digital expirou. Por favor, conclua a entrega o quanto antes para evitar cancelamentos/disputas.');
            }
        } else {
            if ($this->audience === 'buyer') {
                $message->line('O prazo de entrega digital está perto de expirar. Se houver atraso, a intermediadora poderá intervir.');
            } else {
                $message->line('O prazo de entrega digital está perto de expirar. Por favor, conclua a entrega no prazo.');
            }
        }

        return $message;
    }
}
