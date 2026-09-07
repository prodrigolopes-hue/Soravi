# Atribuição da blocklist de senhas comuns

Este diretório contém uma blocklist de senhas comuns derivada de uma fonte de
terceiros, usada exclusivamente para rejeitar senhas óbvias no cadastro e na
redefinição de senha da Soravi (ASVS 5.0.0 V6.2.4).

## Fonte

- Projeto: [SecLists](https://github.com/danielmiessler/SecLists) (danielmiessler/SecLists)
- Licença da fonte: MIT License
- Arquivo original: `Passwords/Common-Credentials/xato-net-10-million-passwords-1000000.txt`
  (lista de senhas do dataset xato.net, ordenada da mais para a menos comum;
  arquivo da família xato-net top-1.000.000 disponível no snapshot utilizado,
  equivalente em propósito ao caminho `Passwords/Common-Credentials/10-million-password-list-top-1000000.txt`
  citado na tarefa original — esse nome de arquivo não existe no commit
  utilizado; não foi confirmado se o conteúdo byte a byte é idêntico ao de
  versões antigas do SecLists com aquele nome)
- Commit SHA usado como snapshot: `3153474db3a882d4410aa4f4f0ac300cca0fee0e`
  (HEAD de `master` no momento da geração, obtido via
  `https://api.github.com/repos/danielmiessler/SecLists/commits/master`)
- URL imutável usada para download:
  `https://raw.githubusercontent.com/danielmiessler/SecLists/3153474db3a882d4410aa4f4f0ac300cca0fee0e/Passwords/Common-Credentials/xato-net-10-million-passwords-1000000.txt`
- Data da geração: 2026-09-07
- Tamanho do arquivo original nesse commit: 8.557.632 bytes / 1.000.000 linhas

## Regra de seleção aplicada

A partir do arquivo original (ordem original preservada, da senha mais comum
para a menos comum), a lista final `common-passwords.ts` foi gerada assim:

1. leitura das senhas na ordem original da fonte;
2. mantidas somente entradas com comprimento entre 12 e 128 caracteres
   (compatível com a política oficial de senha da Soravi);
3. deduplicação case-insensitive, preservando a primeira ocorrência na ordem
   original;
4. seleção das primeiras 3000 entradas resultantes desse filtro;
5. armazenamento apenas dessas 3000 entradas — a lista original de
   1.000.000 de senhas **não** é armazenada neste repositório.

## Quantidade final

`SORAVI_COMMON_PASSWORDS_BLOCKLIST` contém exatamente **3000** entradas.

## Uso

A comparação em `isCommonPassword`/`ensurePasswordIsAllowed` (`password-policy.ts`)
usa `toLowerCase()` apenas para fins de comparação (lookup case-insensitive). O
valor original recebido do usuário nunca é modificado, truncado ou normalizado
antes do hashing/verificação.

## Licença

O conteúdo de `common-passwords.ts` é derivado do SecLists, distribuído sob a
licença MIT. O texto da licença MIT do SecLists está reproduzido abaixo para
fins de atribuição.

```
MIT License

Copyright (c) 2018 Daniel Miessler

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
