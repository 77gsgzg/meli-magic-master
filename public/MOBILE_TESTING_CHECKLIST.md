# Checklist de Testes de Responsividade Mobile

Este documento serve como guia para validação manual da responsividade do aplicativo em dispositivos móveis.

---

## Como Testar

1. No Lovable, clique no ícone de dispositivo (📱) acima da preview para alternar entre Desktop, Tablet e Mobile
2. Ou use as ferramentas de desenvolvedor do navegador (F12 → Toggle device toolbar)
3. Teste em resoluções: 375px (iPhone SE), 390px (iPhone 12), 414px (iPhone Plus), 360px (Android)

---

## 📦 Página: Produtos (/products)

### Layout
- [ ] Cards de produtos empilhados verticalmente
- [ ] Imagem + informações lado a lado dentro de cada card
- [ ] Botão de ações (3 pontos) acessível e funcional

### Filtros
- [ ] Campo de busca ocupa largura total
- [ ] Botões "Exportar" e "Atualizar" visíveis e clicáveis
- [ ] Tabs de status com scroll horizontal ou wrap

### Swipe
- [ ] Indicador de swipe (pontos) visível abaixo das tabs
- [ ] Gesto de deslizar muda a aba corretamente
- [ ] Setas indicam direções disponíveis

### Paginação
- [ ] Botões "Anterior/Próximo" com tamanho adequado
- [ ] Números de página clicáveis

### Modal de Edição
- [ ] Modal abre em tela cheia ou ocupa área adequada
- [ ] Campos de formulário com largura total
- [ ] Botões de ação visíveis

---

## 🔗 Página: Webhooks (/webhooks)

### Tabs
- [ ] Todas as 5 tabs visíveis (Config, Monitor, Fila, Agendamento, Logs)
- [ ] Ícones + texto abreviado no mobile
- [ ] Swipe entre tabs funciona

### Swipe
- [ ] Indicador de swipe visível
- [ ] Navegação por gesto funcional

### Tab Config
- [ ] Lista de webhooks em cards empilhados
- [ ] Botão "Criar Webhook" acessível
- [ ] Ações (testar, editar, excluir) funcionais

### Tab Logs
- [ ] Filtros responsivos
- [ ] Tabela com scroll horizontal ou cards
- [ ] Paginação funcional

### Dialogs
- [ ] Modal de criação/edição de webhook responsivo
- [ ] Campos de formulário com largura adequada
- [ ] Checkboxes de eventos acessíveis

---

## 📊 Página: Métricas (/metrics)

### Controles
- [ ] Seletor de período responsivo
- [ ] Botões de ação empilhados ou em linha
- [ ] Switch "Compacto" visível

### Cards de Estatísticas
- [ ] Grid 2x2 ou coluna única
- [ ] Números legíveis
- [ ] Ícones proporcionais

### Gráficos
- [ ] Tabs de gráficos com swipe
- [ ] Indicador de swipe visível
- [ ] Gráficos redimensionados (modo compacto)
- [ ] Labels e legendas legíveis
- [ ] Touch nos gráficos funciona (tooltips)

### Comparação de Períodos
- [ ] Card de comparação empilhado verticalmente
- [ ] Valores e porcentagens legíveis

---

## ⚙️ Página: Configurações (/settings)

### Tabs
- [ ] Todas as tabs visíveis (Perfil, Preferências, Notificações, etc.)
- [ ] Swipe entre tabs funciona
- [ ] Indicador de swipe visível

### Formulários
- [ ] Campos de input com largura total
- [ ] Labels acima dos campos
- [ ] Switches alinhados corretamente
- [ ] Botões de salvar acessíveis

### Seções
- [ ] Cards de seção empilhados
- [ ] Accordion funcional (se usado)
- [ ] Espaçamento adequado entre elementos

---

## 🏠 Página: Dashboard (/)

### Cards de Estatísticas
- [ ] Grid responsivo (2 colunas no mobile)
- [ ] Ícones e valores proporcionais

### Seções
- [ ] "Importação Rápida" com campo de URL largo
- [ ] "Produtos Recentes" em lista vertical
- [ ] "Feed de Atividades" legível

### Navegação
- [ ] Menu hambúrguer funcional
- [ ] Sidebar abre/fecha corretamente
- [ ] Links navegam corretamente

---

## 📈 Página: Analytics (/analytics)

### Tabs
- [ ] Visão Geral, IA vs Manual, Metas, Relatórios
- [ ] Swipe funciona (se implementado)

### Gráficos
- [ ] Responsivos e legíveis
- [ ] Legendas não cortadas
- [ ] Tooltips funcionais

### Cards de Métricas
- [ ] Empilhados ou em grid 2x2

---

## 🔐 Página: Auth (/auth)

### Formulário de Login/Registro
- [ ] Campos com largura total
- [ ] Botões de submit grandes e clicáveis
- [ ] Mensagens de erro visíveis
- [ ] Alternância login/registro funcional

### OAuth
- [ ] Botão de login com Mercado Livre visível
- [ ] Fluxo OAuth abre no navegador mobile
- [ ] Retorno ao app após autorização

---

## ✅ Critérios Gerais (Todas as Páginas)

### Touch
- [ ] Botões com min 44x44px de área de toque
- [ ] Espaçamento mínimo de 8px entre elementos clicáveis
- [ ] Sem cliques acidentais em elementos adjacentes

### Tipografia
- [ ] Texto legível (min 14px para corpo)
- [ ] Contraste adequado (WCAG AA)
- [ ] Sem texto cortado ou overflow

### Scroll
- [ ] Scroll vertical suave
- [ ] Sem scroll horizontal indesejado na página
- [ ] Pull-to-refresh (se aplicável)

### Feedback
- [ ] Loading states visíveis
- [ ] Toasts/mensagens não bloqueiam UI
- [ ] Estados de erro claros

### Performance
- [ ] Carregamento inicial < 3s
- [ ] Transições suaves (60fps)
- [ ] Sem travamentos ao interagir

---

## 🐛 Como Reportar Problemas

1. Anote a página e o elemento específico
2. Descreva o comportamento esperado vs atual
3. Inclua resolução de tela testada
4. Se possível, capture screenshot/vídeo

---

*Última atualização: Janeiro 2026*
