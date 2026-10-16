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

- **Desktop:** roda do mouse ou touchpad para mudar a fragrância; clique e arraste a faixa inferior para ver os formatos ou use as setas redondas quando houver itens ocultos. Clique em um quadro para escolher o formato; miniaturas circulares à direita trocam a fragrância. Menu vertical à esquerda e CTA “Explorar fragrância”.
- **Mobile:** ative o modo responsivo do Chrome/Edge (F12 → Toggle device toolbar), use viewport de 390×844 ou 360×740. Deslize verticalmente para trocar a fragrância; deslize horizontalmente na faixa inferior para selecionar o próximo formato. Uma fragrância por tela, sem scroll de documento.
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

## Miniaturas dos formatos por fragrância

O carrossel mantém a ordem definida em `catalog.formats` e a escolha do formato
permanece independente da fragrância ativa. Cada fragrância possui seu próprio
mapa opcional `formatImages`, indexado pelo ID exato do formato.

As sete artes de **Frutas Vermelhas** estão em
`public/assets/formats/frutas-vermelhas/` com duas versões WebP por formato:

- `<formato>-640.webp` — 640 × 360 px, para os cartões em telas normais;
- `<formato>-1200.webp` — 1200 × 675 px, para telas de alta densidade.

O Angular escolhe a resolução por `srcset`/`sizes`. As artes são apresentadas
inteiras com `object-fit: contain`, na proporção exata de 16:9, sem cortes nem
texto/gramagem duplicados por cima das fotografias. Nome e peso continuam no
`aria-label` do botão, preservando acessibilidade.

Para cadastrar outra fragrância, adicione os WebP em sua própria pasta e o
respectivo objeto `formatImages` dentro da fragrância em
`public/data/catalog.json`. Não coloque uma imagem global no formato:
a aparência da barra, por exemplo, depende da fragrância selecionada.
Fragrâncias sem artes próprias exibem o espaço vazio, nunca imagens de outra
fragrância.

A ordem dos formatos é por gramagem crescente: Coraçõezinhos (≈ 1,5 g),
Mini Florzinhas (≈ 5 g), Patinha M (≈ 40 g), Patinha G (≈ 60 g),
Barra arredondada (≈ 90 g), Floral (≈ 90 g) e Massageador (≈ 120 g). O sistema continua permitindo arraste
do carrossel por mouse ou toque, navegação por setas e seleção por clique.
