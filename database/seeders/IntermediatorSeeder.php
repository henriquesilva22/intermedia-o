<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class IntermediatorSeeder extends Seeder
{
    /**
     * Cria o usuário intermediador padrão.
     */
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'admin@intermediacaopro.com'],
            [
                'name' => 'Intermediador (Admin)',
                'phone' => '11999999998',
                'role' => 'admin',
                'password' => Hash::make('Senha@123'),
                'email_verified_at' => now(),
                'address_zipcode' => '01310-100',
                'address_street' => 'Av. Paulista',
                'address_number' => '1000',
                'address_neighborhood' => 'Bela Vista',
                'address_city' => 'São Paulo',
                'address_state' => 'SP',
            ]
        );

        User::updateOrCreate(
            ['email' => 'intermediador@intermediacaopro.com'],
            [
                'name' => 'Intermediador Principal',
                'phone' => '11999999999',
                'role' => 'intermediator',
                'intermediator_code' => 1,
                'is_intermediator_principal' => true,
                'password' => Hash::make('Senha@123'),
                'email_verified_at' => now(),
                'address_zipcode' => '01310-100',
                'address_street' => 'Av. Paulista',
                'address_number' => '1000',
                'address_neighborhood' => 'Bela Vista',
                'address_city' => 'São Paulo',
                'address_state' => 'SP',
            ]
        );

        $this->command->info('Usuários criados/atualizados com sucesso:');
        $this->command->info('Admin: admin@intermediacaopro.com / Senha: Senha@123');
        $this->command->info('Intermediador: intermediador@intermediacaopro.com / Senha: Senha@123');
    }
}
