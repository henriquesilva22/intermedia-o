<?php

return [
    /*
     |--------------------------------------------------------------------------
     | Service Forms Configuration
     |--------------------------------------------------------------------------
     |
     | This config powers a dynamic flow:
     |   Selecionar Serviço -> Selecionar Jogo -> Campos dinâmicos
     |
     | Add new games/fields here without changing the database schema.
     |
     */

    'services' => [
        ['id' => 'boost_rank', 'label' => 'Boost de Rank'],
        ['id' => 'carry_pve', 'label' => 'Carry de Conteúdo (PvE)'],
        ['id' => 'leveling', 'label' => 'Leveling'],
        ['id' => 'currency', 'label' => 'Venda de Moeda'],
        ['id' => 'collectibles', 'label' => 'Conquistas / Colecionáveis'],
        ['id' => 'seasonal', 'label' => 'Serviço de Temporada'],
        ['id' => 'custom', 'label' => 'Serviço Personalizado'],
    ],

    'games' => [
        'wow' => 'World of Warcraft',
        'valorant' => 'Valorant',
        'cs2' => 'Counter-Strike 2',
        'lol' => 'League of Legends',
        'ffxiv' => 'Final Fantasy XIV',
        'tibia' => 'Tibia',
        'diablo4' => 'Diablo IV',
        'albion' => 'Albion Online',
        'any' => 'Qualquer jogo',
        'other' => 'Outro (escrever)',
    ],

    'serviceGames' => [
        // Until now (plus "other" as free-text game)
        // Rules (fixed): only show games that support the service.
        // Universal: ask for game title (free-text) instead of fixed game list.
        'boost_rank' => ['other'],
        // Universal: ask for game title (free-text) instead of fixed game list.
        'carry_pve' => ['other'],
        'leveling' => ['wow', 'albion', 'tibia', 'ffxiv', 'diablo4'],
        'currency' => ['wow', 'albion', 'tibia', 'ffxiv'],
        'collectibles' => ['wow', 'ffxiv'],
        'seasonal' => ['valorant', 'cs2', 'diablo4'],
        'custom' => ['any', 'other'],
    ],

    // formFields[service_id][game_id] = fields[]
    'formFields' => [
        'boost_rank' => [
            'valorant' => [
                ['id' => 'region', 'label' => 'Região', 'type' => 'select', 'options' => []],
                ['id' => 'rank_current', 'label' => 'Rank atual', 'type' => 'text'],
                ['id' => 'rank_target', 'label' => 'Rank desejado', 'type' => 'text'],
                ['id' => 'method', 'label' => 'Método', 'type' => 'select', 'options' => ['Duo', 'Acesso à conta']],
                ['id' => 'wins_estimate', 'label' => 'Estimativa de vitórias', 'type' => 'number'],
                ['id' => 'delivery_deadline', 'label' => 'Prazo para entrega', 'type' => 'text'],
                ['id' => 'time_needed', 'label' => 'Tempo necessário para realizar', 'type' => 'text'],
                ['id' => 'notes', 'label' => 'Observações', 'type' => 'textarea'],
            ],
            'cs2' => [
                ['id' => 'rank_current', 'label' => 'Rank atual', 'type' => 'text'],
                ['id' => 'rank_target', 'label' => 'Rank desejado', 'type' => 'text'],
                ['id' => 'prime', 'label' => 'Prime', 'type' => 'select', 'options' => ['Sim', 'Não']],
                ['id' => 'method', 'label' => 'Método', 'type' => 'select', 'options' => ['Duo', 'Acesso à conta']],
                ['id' => 'delivery_deadline', 'label' => 'Prazo para entrega', 'type' => 'text'],
                ['id' => 'time_needed', 'label' => 'Tempo necessário para realizar', 'type' => 'text'],
                ['id' => 'notes', 'label' => 'Observações', 'type' => 'textarea'],
            ],
            'lol' => [
                ['id' => 'server', 'label' => 'Servidor', 'type' => 'text'],
                ['id' => 'elo_current', 'label' => 'Elo atual', 'type' => 'text'],
                ['id' => 'elo_target', 'label' => 'Elo desejado', 'type' => 'text'],
                ['id' => 'method', 'label' => 'Método', 'type' => 'select', 'options' => ['Duo', 'Acesso à conta']],
                ['id' => 'delivery_deadline', 'label' => 'Prazo para entrega', 'type' => 'text'],
                ['id' => 'time_needed', 'label' => 'Tempo necessário para realizar', 'type' => 'text'],
            ],
            'wow' => [
                ['id' => 'region', 'label' => 'Região', 'type' => 'select', 'options' => []],
                ['id' => 'faction', 'label' => 'Facção', 'type' => 'select', 'options' => []],
                ['id' => 'mode', 'label' => 'Modalidade', 'type' => 'select', 'options' => ['Arena', 'RBG']],
                ['id' => 'rating_current', 'label' => 'Rating atual', 'type' => 'number'],
                ['id' => 'rating_target', 'label' => 'Rating desejado', 'type' => 'number'],
                ['id' => 'class_spec', 'label' => 'Classe / Especialização', 'type' => 'text'],
                ['id' => 'method', 'label' => 'Método', 'type' => 'select', 'options' => ['Duo', 'Acesso à conta']],
                ['id' => 'delivery_deadline', 'label' => 'Prazo para entrega', 'type' => 'text'],
                ['id' => 'time_needed', 'label' => 'Tempo necessário para realizar', 'type' => 'text'],
                ['id' => 'notes', 'label' => 'Observações', 'type' => 'textarea'],
            ],
            'other' => [
                ['id' => 'game_other_name', 'label' => 'Nome do jogo', 'type' => 'text'],
                ['id' => 'notes', 'label' => 'Observações', 'type' => 'textarea'],
            ],
        ],

        'carry_pve' => [
            // Universal model (Modelo Final): use free-text game title.
            'other' => [
                // 1) Identificação do Serviço
                ['id' => 'game_other_name', 'label' => 'Nome do jogo', 'type' => 'text'],
                ['id' => 'platform', 'label' => 'Plataforma', 'type' => 'text'],
                ['id' => 'region_server', 'label' => 'Região / Servidor', 'type' => 'text'],

                // 2) Definição do Conteúdo
                ['id' => 'content_type', 'label' => 'Tipo de Conteúdo', 'type' => 'select', 'options' => ['Raid', 'Dungeon', 'Boss', 'Evento', 'Farm', 'Missão', 'Outro']],
                ['id' => 'content_name', 'label' => 'Nome do Conteúdo', 'type' => 'text'],
                ['id' => 'objective', 'label' => 'Objetivo do Serviço', 'type' => 'select', 'options' => ['Completar conteúdo', 'Farmar item', 'Conquista', 'Liberar conteúdo', 'Outro']],

                // 3) Execução do Serviço
                ['id' => 'difficulty', 'label' => 'Dificuldade', 'type' => 'text'],
                ['id' => 'runs_count', 'label' => 'Quantidade de Runs', 'type' => 'number'],
                ['id' => 'client_participation', 'label' => 'Cliente participa?', 'type' => 'select', 'options' => ['Sim', 'Não']],
                ['id' => 'client_class_build', 'label' => 'Classe / Build', 'type' => 'text'],
                ['id' => 'client_group_role', 'label' => 'Função no grupo', 'type' => 'text'],

                // 4) Pontuação / Score (opcional)
                ['id' => 'score_has_system', 'label' => 'Conta possui sistema de pontuação?', 'type' => 'select', 'options' => ['Sim', 'Não', 'Não sei']],
                ['id' => 'score_current', 'label' => 'Pontuação atual do cliente', 'type' => 'number'],
                ['id' => 'score_target', 'label' => 'Pontuação desejada', 'type' => 'number'],
                ['id' => 'score_type', 'label' => 'Tipo de pontuação', 'type' => 'text'],

                // 5) Disponibilidade e Prazo
                // Disponibilidade: 1 slot principal + até 2 adicionais (máx 3)
                ['id' => 'slot1_date', 'label' => 'Data (principal)', 'type' => 'text'],
                ['id' => 'slot1_time', 'label' => 'Hora (principal)', 'type' => 'text'],
                ['id' => 'slot2_date', 'label' => 'Data (opcional)', 'type' => 'text'],
                ['id' => 'slot2_time', 'label' => 'Hora (opcional)', 'type' => 'text'],
                ['id' => 'slot3_date', 'label' => 'Data (opcional)', 'type' => 'text'],
                ['id' => 'slot3_time', 'label' => 'Hora (opcional)', 'type' => 'text'],
                ['id' => 'preferred_slot', 'label' => 'Horário principal', 'type' => 'select', 'options' => ['1', '2', '3']],

                ['id' => 'delivery_deadline', 'label' => 'Prazo para entrega', 'type' => 'text'],
                ['id' => 'time_needed', 'label' => 'Tempo necessário para realizar', 'type' => 'text'],

                // 6) Forma de Execução
                ['id' => 'execution_method', 'label' => 'Como será feito', 'type' => 'select', 'options' => ['Cliente joga junto', 'Booster joga', 'Misto']],
                ['id' => 'needs_account_access', 'label' => 'Necessita acesso à conta?', 'type' => 'select', 'options' => ['Sim', 'Não']],
                ['id' => 'warranty', 'label' => 'Possui garantia?', 'type' => 'select', 'options' => ['Sim', 'Não']],

                // 7) Recompensas Esperadas
                ['id' => 'reward_main', 'label' => 'Recompensa principal', 'type' => 'text'],
                // RNG removido (não necessário)

                // 8) Provas
                ['id' => 'proofs', 'label' => 'Provas', 'type' => 'select', 'options' => ['Screenshot', 'Vídeo', 'Stream', 'Log', 'Nenhum']],

                // 9) Observações
                ['id' => 'notes', 'label' => 'Observações Gerais', 'type' => 'textarea'],
            ],
        ],

        'leveling' => [
            'wow' => [
                ['id' => 'level_current', 'label' => 'Level atual', 'type' => 'text'],
                ['id' => 'level_target', 'label' => 'Level desejado', 'type' => 'text'],
                ['id' => 'class', 'label' => 'Classe', 'type' => 'text'],
                ['id' => 'method', 'label' => 'Método', 'type' => 'select', 'options' => ['Power', 'Duo']],
                ['id' => 'region', 'label' => 'Região', 'type' => 'select', 'options' => []],
                ['id' => 'deadline', 'label' => 'Prazo', 'type' => 'text'],
            ],
            'albion' => [
                ['id' => 'fame_type', 'label' => 'Tipo de fama', 'type' => 'select', 'options' => ['Combate', 'Craft', 'Gathering']],
                ['id' => 'fame_current', 'label' => 'Fama atual', 'type' => 'text'],
                ['id' => 'fame_target', 'label' => 'Fama desejada', 'type' => 'text'],
                ['id' => 'build', 'label' => 'Build', 'type' => 'text'],
                ['id' => 'method', 'label' => 'Método', 'type' => 'text'],
                ['id' => 'deadline', 'label' => 'Prazo', 'type' => 'text'],
            ],
            'tibia' => [
                ['id' => 'world', 'label' => 'Mundo / Servidor', 'type' => 'text'],
                ['id' => 'level_current', 'label' => 'Level atual', 'type' => 'text'],
                ['id' => 'level_target', 'label' => 'Level desejado', 'type' => 'text'],
                ['id' => 'vocation', 'label' => 'Vocação', 'type' => 'text'],
                ['id' => 'method', 'label' => 'Método', 'type' => 'text'],
                ['id' => 'deadline', 'label' => 'Prazo', 'type' => 'text'],
            ],
            'ffxiv' => [
                ['id' => 'job', 'label' => 'Job', 'type' => 'text'],
                ['id' => 'level_current', 'label' => 'Level atual', 'type' => 'text'],
                ['id' => 'level_target', 'label' => 'Level desejado', 'type' => 'text'],
                ['id' => 'method', 'label' => 'Método', 'type' => 'text'],
                ['id' => 'deadline', 'label' => 'Prazo', 'type' => 'text'],
            ],
            'diablo4' => [
                ['id' => 'level_current', 'label' => 'Level atual', 'type' => 'text'],
                ['id' => 'level_target', 'label' => 'Level desejado', 'type' => 'text'],
                ['id' => 'class_build', 'label' => 'Classe / Build', 'type' => 'text'],
                ['id' => 'method', 'label' => 'Método', 'type' => 'text'],
                ['id' => 'deadline', 'label' => 'Prazo', 'type' => 'text'],
            ],
            'other' => [
                ['id' => 'game_other_name', 'label' => 'Nome do jogo', 'type' => 'text'],
                ['id' => 'target', 'label' => 'Objetivo / nível desejado', 'type' => 'text'],
                ['id' => 'notes', 'label' => 'Observações', 'type' => 'textarea'],
            ],
        ],

        'currency' => [
            'wow' => [
                ['id' => 'server', 'label' => 'Servidor', 'type' => 'text'],
                ['id' => 'faction', 'label' => 'Facção', 'type' => 'select', 'options' => []],
                ['id' => 'quantity_gold', 'label' => 'Quantidade de gold', 'type' => 'text'],
                ['id' => 'delivery_method', 'label' => 'Método de entrega', 'type' => 'select', 'options' => ['Trade', 'Correio (mail)', 'Presente (gift)']],
                ['id' => 'deadline', 'label' => 'Prazo', 'type' => 'text'],
            ],
            'albion' => [
                ['id' => 'server', 'label' => 'Servidor / Região', 'type' => 'text'],
                ['id' => 'quantity_silver', 'label' => 'Quantidade de silver', 'type' => 'text'],
                ['id' => 'delivery_method', 'label' => 'Método de entrega', 'type' => 'select', 'options' => ['Trade', 'Correio (mail)', 'Presente (gift)']],
                ['id' => 'deadline', 'label' => 'Prazo', 'type' => 'text'],
            ],
            'tibia' => [
                ['id' => 'world', 'label' => 'Mundo / Servidor', 'type' => 'text'],
                ['id' => 'quantity_gold', 'label' => 'Quantidade de gold', 'type' => 'text'],
                ['id' => 'delivery_method', 'label' => 'Método de entrega', 'type' => 'select', 'options' => ['Trade', 'Correio (mail)', 'Presente (gift)']],
                ['id' => 'deadline', 'label' => 'Prazo', 'type' => 'text'],
            ],
            'ffxiv' => [
                ['id' => 'data_center', 'label' => 'Data Center', 'type' => 'text'],
                ['id' => 'server', 'label' => 'Servidor', 'type' => 'text'],
                ['id' => 'quantity_gil', 'label' => 'Quantidade de gil', 'type' => 'text'],
                ['id' => 'delivery_method', 'label' => 'Método de entrega', 'type' => 'select', 'options' => ['Trade', 'Correio (mail)', 'Presente (gift)']],
                ['id' => 'deadline', 'label' => 'Prazo', 'type' => 'text'],
            ],
            'other' => [
                ['id' => 'game_other_name', 'label' => 'Nome do jogo', 'type' => 'text'],
                ['id' => 'currency_type', 'label' => 'Tipo de moeda', 'type' => 'text'],
                ['id' => 'quantity', 'label' => 'Quantidade', 'type' => 'text'],
                ['id' => 'notes', 'label' => 'Observações', 'type' => 'textarea'],
            ],
        ],

        'collectibles' => [
            'wow' => [
                ['id' => 'type', 'label' => 'Tipo', 'type' => 'select', 'options' => ['Conquista', 'Montaria', 'Título']],
                ['id' => 'item_name', 'label' => 'Nome do item', 'type' => 'text'],
                ['id' => 'method', 'label' => 'Método', 'type' => 'select', 'options' => ['Carry', 'Acesso à conta']],
                ['id' => 'deadline', 'label' => 'Prazo', 'type' => 'text'],
            ],
            'ffxiv' => [
                ['id' => 'type', 'label' => 'Tipo', 'type' => 'select', 'options' => ['Achievement', 'Mount']],
                ['id' => 'related_content', 'label' => 'Conteúdo relacionado', 'type' => 'text'],
                ['id' => 'method', 'label' => 'Método', 'type' => 'text'],
                ['id' => 'deadline', 'label' => 'Prazo', 'type' => 'text'],
            ],
            'other' => [
                ['id' => 'game_other_name', 'label' => 'Nome do jogo', 'type' => 'text'],
                ['id' => 'what', 'label' => 'O que será feito?', 'type' => 'textarea'],
                ['id' => 'notes', 'label' => 'Observações', 'type' => 'textarea'],
            ],
        ],

        'seasonal' => [
            'valorant' => [
                ['id' => 'season', 'label' => 'Temporada', 'type' => 'text'],
                ['id' => 'pass_level_current', 'label' => 'Nível atual do passe', 'type' => 'text'],
                ['id' => 'objective', 'label' => 'Objetivo', 'type' => 'text'],
                ['id' => 'method', 'label' => 'Método', 'type' => 'text'],
                ['id' => 'deadline', 'label' => 'Prazo', 'type' => 'text'],
            ],
            'cs2' => [
                ['id' => 'type', 'label' => 'Tipo', 'type' => 'select', 'options' => ['Vitórias', 'Evento']],
                ['id' => 'quantity', 'label' => 'Quantidade', 'type' => 'number'],
                ['id' => 'method', 'label' => 'Método', 'type' => 'text'],
                ['id' => 'deadline', 'label' => 'Prazo', 'type' => 'text'],
            ],
            'diablo4' => [
                ['id' => 'season', 'label' => 'Temporada', 'type' => 'text'],
                ['id' => 'objective', 'label' => 'Objetivo', 'type' => 'text'],
                ['id' => 'deadline', 'label' => 'Prazo', 'type' => 'text'],
            ],
            'other' => [
                ['id' => 'game_other_name', 'label' => 'Nome do jogo', 'type' => 'text'],
                ['id' => 'what', 'label' => 'O que será feito?', 'type' => 'textarea'],
                ['id' => 'notes', 'label' => 'Observações', 'type' => 'textarea'],
            ],
        ],

        // Example placeholder: custom service for any game
        'custom' => [
            'any' => [
                ['id' => 'game', 'label' => 'Jogo', 'type' => 'text'],
                ['id' => 'description', 'label' => 'Descrição do serviço', 'type' => 'textarea'],
                ['id' => 'deadline', 'label' => 'Prazo', 'type' => 'text'],
            ],
            'other' => [
                ['id' => 'game_other_name', 'label' => 'Nome do jogo', 'type' => 'text'],
                ['id' => 'description', 'label' => 'Descrição', 'type' => 'textarea'],
                ['id' => 'deadline', 'label' => 'Prazo', 'type' => 'text'],
            ],
        ],
    ],
];
