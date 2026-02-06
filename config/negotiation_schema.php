<?php

return [
    // Versão do schema do formulário (para migrações graduais e retrocompatibilidade)
    'schema_version' => 1,

    // Campo universal: sempre presente para categorias de jogos
    'universal' => [
        'universal.game_name' => [
            'label' => 'Jogo',
            'type' => 'text',
            'max' => 120,
        ],
        'universal.platform' => [
            'label' => 'Plataforma',
            'type' => 'select',
            'max' => 60,
        ],
        'universal.region_server' => [
            'label' => 'Região / Servidor',
            'type' => 'text',
            'max' => 120,
        ],
        'universal.game_type' => [
            'label' => 'Tipo de jogo',
            'type' => 'select',
            'max' => 40,
            'allowed' => ['mmorpg', 'fps', 'moba', 'battle_royale', 'mobile', 'estrategia', 'esporte', 'other'],
        ],
        'universal.negotiation_type' => [
            'label' => 'Tipo de negociação',
            'type' => 'select',
            'allowed' => ['digital', 'physical'],
        ],
    ],

    'commercial' => [
        'commercial.price' => [
            'label' => 'Preço',
            'type' => 'money',
        ],
        'commercial.allows_negotiation' => [
            'label' => 'Permite negociação',
            'type' => 'boolean',
        ],
        'commercial.delivery_method' => [
            'label' => 'Método de entrega',
            'type' => 'select',
            'max' => 40,
        ],
        'commercial.estimated_delivery' => [
            'label' => 'Tempo estimado de entrega',
            'type' => 'text',
            'max' => 80,
        ],
    ],

    'security' => [
        'security.first_owner' => [
            'label' => 'Primeiro dono',
            'type' => 'boolean',
        ],
        'security.has_original_email' => [
            'label' => 'Possui email original',
            'type' => 'boolean',
        ],
        'security.ban_history' => [
            'label' => 'Histórico de ban',
            'type' => 'text',
            'max' => 40,
        ],
        'security.linked_third_parties' => [
            'label' => 'Conta vinculada a terceiros',
            'type' => 'array',
        ],
        'security.proofs' => [
            'label' => 'Provas',
            'type' => 'media',
        ],
    ],

    // Plugins por categoria: lista de field_ids adicionais.
    // Objetivo: adicionar categorias novas sem mexer em migrations/estrutura principal.
    'categories' => [
        'Conta de jogo' => [
            'fields' => [
                'category.game_account.level',
                'category.game_account.main_character',
                'category.game_account.characters_count',
                'category.game_account.progression',
                'category.game_account.resources',
            ],
        ],
        'Moedas / Gold / Créditos' => [
            'fields' => [
                'category.currency.quantity',
                'category.currency.delivery_method',
                'category.currency.delivery_time',
                'category.currency.obtainment_method',
            ],
        ],
        'Boost de Rank' => [
            'fields' => [
                'category.boost.current_rank',
                'category.boost.desired_rank',
                'category.boost.kind',
                'category.boost.client_watches',
                'category.boost.available_times',
                'category.boost.warranty',
            ],
        ],
        'Carry de Conteúdo (PvE)' => [
            'fields' => [
                'category.carry_pve.desired_content',
                'category.carry_pve.difficulty',
                'category.carry_pve.runs_count',
                'category.carry_pve.client_participation',
            ],
        ],
        'Leveling' => [
            'fields' => [
                'category.leveling.current_level',
                'category.leveling.desired_level',
                'category.leveling.method',
                'category.leveling.estimated_time',
            ],
        ],
        'Conquistas / Colecionáveis' => [
            'fields' => [
                'category.collectibles.name',
                'category.collectibles.kind',
                'category.collectibles.estimated_time',
                'category.collectibles.requires_account_access',
            ],
        ],
        'Serviço de Temporada' => [
            'fields' => [
                'category.seasonal.season',
                'category.seasonal.reward',
                'category.seasonal.current_progress',
                'category.seasonal.deadline',
            ],
        ],
        'Serviço Personalizado' => [
            'fields' => [
                'category.custom.goal',
                'category.custom.client_requirements',
                'category.custom.scope',
            ],
        ],
        'Troca de serviço' => [
            'fields' => [
                'category.exchange.offered_item',
                'category.exchange.desired_item',
                'category.exchange.accepts_cash_addon',
            ],
        ],
    ],
];
