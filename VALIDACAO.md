# Validação do protótipo

## Verificações realizadas nesta entrega

- Todas as **18 imagens** das três fragrâncias existem no projeto e são referenciadas pelo JSON.
- As **7 opções de formato** presentes no JSON possuem preços para as duas coleções.
- Os arquivos TypeScript foram analisados sintaticamente, sem erros de sintaxe detectados.
- A composição visual foi inspecionada em ambiente de navegador usando o mesmo CSS e assets do projeto nas dimensões **1440×900**, **1280×720** e **390×844**. Veja `previews/`.
- As imagens mobile do Capim-Limão foram adaptadas de uma imagem horizontal individual, sem utilizar as colagens incorretas criadas anteriormente.

## Limite desta validação

**Não foi possível instalar as dependências npm neste ambiente por indisponibilidade de acesso ao registro do npm.** Portanto, **não foi executado `ng build` nem teste interativo da aplicação Angular compilada**. Isso precisa ser feito após `npm install` no computador que for testar. As prévias são validações de layout CSS e imagens, não evidência de compilação Angular.

## Checklist de aceite local

1. `npm install` termina sem erro.
2. `npm run build` termina sem erros.
3. `npm start` abre o catálogo em `http://localhost:4200/`.
4. Desktop: roda do mouse, teclado e miniaturas trocam de fragrância uma vez por interação.
5. Mobile (390×844 e 360×740): gestos verticais funcionam e nenhum texto/botão fica cortado.
6. A página principal não mostra scrollbar de documento.
7. “Explorar fragrância” exibe corretamente descrição, formato e preço, com rolagem somente no painel.
8. Navegação menu/overlay/tecla Escape e link Instagram funcionam.
9. `prefers-reduced-motion` desativa as animações intensas.
