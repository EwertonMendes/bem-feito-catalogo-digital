# Bem Feito — Essência Viva

Catálogo imersivo **Angular 20 + GSAP 3** em tela cheia, com experiência desktop e mobile inspirada no mockup aprovado. Dados e imagens são locais; não há Firebase, autenticação, estoque nem API nesta versão.

## Requisitos

- Node.js **20.19+ ou 22.12+** (recomendado: versão LTS 22)
- npm atualizado
- Chrome, Edge, Firefox ou Safari atual

## Rodar no Windows (PowerShell)

1. Extraia o ZIP (não rode de dentro do ZIP).
2. Abra a pasta `bem-feito-essencia-viva` no VS Code ou no Explorador.
3. Na barra de endereços da pasta, digite `powershell` e pressione Enter.
4. Rode:

```powershell
npm install
npm start
```

5. Abra **http://localhost:4200/** no navegador.

**Não abra `src/index.html` com dois cliques:** Angular é compilado pelo servidor de desenvolvimento. O HTML isolado não carrega a aplicação.

## Testar

- **Desktop:** roda do mouse ou touchpad para mudar a fragrância; setas direita/esquerda/cima/baixo; miniaturas na barra inferior; miniaturas circulares à direita. Menu vertical à esquerda e CTA “Explorar fragrância”.
- **Mobile:** ative o modo responsivo do Chrome/Edge (F12 → Toggle device toolbar), use viewport de 390×844 ou 360×740. Deslize verticalmente com touch e use indicadores de lado ou menu hambúrguer. Uma fragrância por tela, sem scroll de documento.
- **Detalhes:** clique em “Explorar fragrância” para conhecer a família olfativa, o perfil, escolher formato e visualizar preço. O painel de detalhes pode rolar internamente, mantendo o fundo parado.
- **Movimento reduzido:** teste acessibilidade com preferência `prefers-reduced-motion: reduce` (as animações passam a ser instantâneas).

## Gerar versão de produção

```powershell
npm run build
```

Arquivos gerados em `dist/bem-feito-essencia-viva/browser/`. Publique **essa pasta** em hospedagem estática com fallback para `index.html`.

## Alterar fragrâncias e preços

Edite `public/data/catalog.json`. `fragrances` contém coleção, textos, identidade de cor e caminhos de imagem. `formats` contém pesos aproximados e preços por coleção. As imagens ficam em `public/assets/fragrances/<id>/`.

O catálogo inicial possui três fragrâncias com artes preparadas:
- Frutas Vermelhas
- Lavanda Francesa
- Capim-Limão

Novas fragrâncias podem ser adicionadas com o mesmo schema e 6 imagens próprias (`desktopHero`, `mobileHero`, `desktopBackground`, `mobileBackground`, `avatar`, `detail`).

### Importante sobre os materiais visuais

As imagens são **ilustrativas geradas durante o estudo**, e não fotografias finais. O conjunto de Capim-Limão recebeu uma composição mobile adaptada de uma cena horizontal para manter o layout consistente enquanto os assets definitivos não chegam. Não altere preços no código: mantenha `catalog.json` como fonte única de publicação.

### Sem checkout nesta etapa

Os links de contato levam ao Instagram `@usebemfeito`, configurado no JSON. Não há falsa confirmação de venda, reserva ou carrinho; esses recursos exigem definição posterior.

## Arquitetura

- `src/app/models/catalog.ts`: contratos tipados
- `src/app/services/catalog.service.ts`: leitura do JSON local via `HttpClient`
- `src/app/app.component.*`: experiência e eventos de navegação
- `public/data/catalog.json`: fonte pública do catálogo
- `public/assets/`: imagens otimizadas WebP e logo oficial

Animação gerenciada por GSAP com limpeza em `ngOnDestroy`. Interações respeitam teclado, foco, `prefers-reduced-motion` e fechamento por Escape. A página principal não usa rolagem nativa nem barra de scroll, apenas navegação entre fragrâncias.
