const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'public', 'app', 'app.part2.js');
let content = fs.readFileSync(filePath, 'utf8');

// Find and replace the section
const oldSection = `                  <div>
                    <div class="text-sm text-gray-700 font-medium mb-2">Conta possui vinculações externas *</div>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      \${[
                        { id: 'google', label: 'Google' },
                        { id: 'facebook', label: 'Facebook' },
                        { id: 'steam', label: 'Steam' },
                        { id:'apple', label: 'Apple' },
                        { id: 'riot', label: 'Riot' },
                        { id: 'activision', label: 'Activision' },
                        { id: 'epic', label: 'Epic Games' },
                        { id: 'none', label: 'Nenhuma' },
                      ].map((opt) => \`
                        <label class="flex items-center gap-2 p-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700">
                          <input type="checkbox" name="game_account_linked_providers[]" value="\${opt.id}" \${linkedProviders.includes(opt.id) ? 'checked' : ''}>
                          \${opt.label}
                        </label>
                      \`).join('')}
                    </div>
                    <p class="text-xs text-gray-500 mt-2">Marque pelo menos 1 opção (use "Nenhuma" se não houver).</p>
                  </div>`;

const newSection = `                  <div class="space-y-3">
                    <div class="space-y-2">
                      <div class="text-sm text-gray-700 font-medium">A conta possui vínculos externos? *</div>
                      <label class="flex items-center gap-2 text-sm text-gray-700">
                        <input type="radio" name="game_account_has_linked_providers" value="1" \${hasLinkedProviders === '1' ? 'checked' : ''} data-action="refreshCreateNegDynamicUI">
                        Sim, possui vínculos
                      </label>
                      <label class="flex items-center gap-2 text-sm text-gray-700">
                        <input type="radio" name="game_account_has_linked_providers" value="0" \${hasLinkedProviders === '0' ? 'checked' : ''} data-action="refreshCreateNegDynamicUI">
                        Não possui vínculos
                      </label>
                    </div>

                    \${hasLinkedProviders === '1' ? \`
                      <div>
                        <div class="text-sm text-gray-700 font-medium mb-2">Selecione os vínculos *</div>
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          \${[
                            { id: 'google', label: 'Google' },
                            { id: 'facebook', label: 'Facebook' },
                            { id: 'steam', label: 'Steam' },
                            { id: 'apple', label: 'Apple' },
                            { id: 'riot', label: 'Riot' },
                            { id: 'activision', label: 'Activision' },
                            { id: 'epic', label: 'Epic Games' },
                          ].map((opt) => \\\`
                            <label class="flex items-center gap-2 p-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer transition">
                              <input type="checkbox" name="game_account_linked_providers[]" value="\\\${opt.id}" \\\${linkedProviders.includes(opt.id) ? 'checked' : ''}>
                              \\\${opt.label}
                            </label>
                          \\\`).join('')}
                        </div>
                        <p class="text-xs text-gray-500 mt-2">Marque pelo menos 1 vínculo.</p>
                      </div>
                    \` : ''}
                  </div>`;

if (content.includes('Conta possui vinculações externas *')) {
    console.log('Found section to replace...');
    
    // Try to find and replace using regex for flexibility with whitespace
    const regex = /<div>\s*<div class="text-sm text-gray-700 font-medium mb-2">Conta possui vinculações externas \*<\/div>[\s\S]*?{ id: 'none', label: 'Nenhuma' },[\s\S]*?<p class="text-xs text-gray-500 mt-2">Marque pelo menos 1 opção.*?<\/p>\s*<\/div>/;
    
    if (regex.test(content)) {
        content = content.replace(regex, newSection);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('✓ File updated successfully!');
    } else {
        console.log('✗ Could not find exact pattern to replace');
    }
} else {
    console.log('✗ Section not found in file');
}
