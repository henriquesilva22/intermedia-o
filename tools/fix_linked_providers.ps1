$filePath = "D:\intermediaçâo\app\public\app\app.part2.js"
$content = Get-Content $filePath -Raw -Encoding UTF8

# Pattern to find and replace
$oldPattern = @'
                  <div>
                    <div class="text-sm text-gray-700 font-medium mb-2">Conta possui vinculações externas \*</div>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      \$\{\[
                        \{ id: 'google', label: 'Google' \},
                        \{ id: 'facebook', label: 'Facebook' \},
                        \{ id: 'steam', label: 'Steam' \},
                        \{ id: 'apple', label: 'Apple' \},
                        \{ id: 'riot', label: 'Riot' \},
                        \{ id: 'activision', label: 'Activision' \},
                        \{ id: 'epic', label: 'Epic Games' \},
                        \{ id: 'none', label: 'Nenhuma' \},
                      \]\.map\(\(opt\) => `
'@

$newContent = @'
                  <div class="space-y-3">
                    <div class="space-y-2">
                      <div class="text-sm text-gray-700 font-medium">A conta possui vínculos externos? *</div>
                      <label class="flex items-center gap-2 text-sm text-gray-700">
                        <input type="radio" name="game_account_has_linked_providers" value="1" ${hasLinkedProviders === '1' ? 'checked' : ''} data-action="refreshCreateNegDynamicUI">
                        Sim, possui vínculos
                      </label>
                      <label class="flex items-center gap-2 text-sm text-gray-700">
                        <input type="radio" name="game_account_has_linked_providers" value="0" ${hasLinkedProviders === '0' ? 'checked' : ''} data-action="refreshCreateNegDynamicUI">
                        Não possui vínculos
                      </label>
                    </div>

                    ${hasLinkedProviders === '1' ? `
                      <div>
                        <div class="text-sm text-gray-700 font-medium mb-2">Selecione os vínculos *</div>
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          ${[
                            { id: 'google', label: 'Google' },
                            { id: 'facebook', label: 'Facebook' },
                            { id: 'steam', label: 'Steam' },
                            { id: 'apple', label: 'Apple' },
                            { id: 'riot', label: 'Riot' },
                            { id: 'activision', label: 'Activision' },
                            { id: 'epic', label: 'Epic Games' },
                          ].map((opt) => `
'@

$findText = "                    <div class=`"text-sm text-gray-700 font-medium mb-2`">Conta possui vinculações externas *</div>"

if ($content -match [regex]::Escape($findText)) {
    Write-Host "Found the text to replace!" -ForegroundColor Green
    
    # Simple replacement approach - find the block and replace
    $startMarker = "                  <div>`r`n                    <div class=`"text-sm text-gray-700 font-medium mb-2`">Conta possui vinculações externas *</div>"
    $endMarker = "                    <p class=`"text-xs text-gray-500 mt-2`">Marque pelo menos 1 opção (use `"Nenhuma`" se não houver).</p>`r`n                  </div>"
    
    $replacementBlock = @"
                  <div class="space-y-3">
                    <div class="space-y-2">
                      <div class="text-sm text-gray-700 font-medium">A conta possui vínculos externos? *</div>
                      <label class="flex items-center gap-2 text-sm text-gray-700">
                        <input type="radio" name="game_account_has_linked_providers" value="1" `${hasLinkedProviders === '1' ? 'checked' : ''} data-action="refreshCreateNegDynamicUI">
                        Sim, possui vínculos
                      </label>
                      <label class="flex items-center gap-2 text-sm text-gray-700">
                        <input type="radio" name="game_account_has_linked_providers" value="0" `${hasLinkedProviders === '0' ? 'checked' : ''} data-action="refreshCreateNegDynamicUI">
                        Não possui vínculos
                      </label>
                    </div>

                    `${hasLinkedProviders === '1' ? ``
                      <div>
                        <div class="text-sm text-gray-700 font-medium mb-2">Selecione os vínculos *</div>
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          `${[
                            { id: 'google', label: 'Google' },
                            { id: 'facebook', label: 'Facebook' },
                            { id: 'steam', label: 'Steam' },
                            { id: 'apple', label: 'Apple' },
                            { id: 'riot', label: 'Riot' },
                            { id: 'activision', label: 'Activision' },
                            { id: 'epic', label: 'Epic Games' },
                          ].map((opt) => ```
                            <label class="flex items-center gap-2 p-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer transition">
                              <input type="checkbox" name="game_account_linked_providers[]" value="`${opt.id}" `${linkedProviders.includes(opt.id) ? 'checked' : ''}>
                              `${opt.label}
                            </label>
                          ```).join('')}
                        </div>
                        <p class="text-xs text-gray-500 mt-2">Marque pelo menos 1 vínculo.</p>
                      </div>
                    `` : ''}
                  </div>
"@
    
    # Use line-by-line approach to be safer
    $lines = $content -split "`r?`n"
    $outputLines = @()
    $skipUntilLine = -1
    
    for ($i = 0; $i < $lines.Count; $i++) {
        if ($i -lt $skipUntilLine) {
            continue
        }
        
        if ($lines[$i] -match 'Conta possui vinculações externas \*') {
            # Found start - find end
            $outputLines += $replacementBlock -split "`r?`n"
            
            # Skip until we find the closing </div> after "Nenhuma"
            for ($j = $i; $j < $lines.Count; $j++) {
                if ($lines[$j] -match 'Marque pelo menos 1 opção.*Nenhuma') {
                    $skipUntilLine = $j + 2  # Skip the </div> after this line too
                    break
                }
            }
        } else {
            $outputLines += $lines[$i]
        }
    }
    
    $newContent = $outputLines -join "`r`n"
    $newContent | Set-Content $filePath -Encoding UTF8 -NoNewline
    Write-Host "File updated successfully!" -ForegroundColor Green
} else {
    Write-Host "Could not find the text to replace!" -ForegroundColor Red
}
