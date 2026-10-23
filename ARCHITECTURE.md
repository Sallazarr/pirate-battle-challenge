# 🏛️ Documento de Arquitetura — Pirate Battle

Este documento descreve as principais decisões de engenharia, padrões de projeto e estratégias de integração adotadas no desenvolvimento do **Pirate Battle**, contemplando a simulação de combate em tempo real e a persistência de dados.

---

## 1. Integração React & PixiJS

A arquitetura separa claramente as responsabilidades de interface e de renderização gráfica de alta performance:

- **React:** Responsável por gerir toda a árvore de componentes de interface de utilizador (UI), incluindo o **Menu Principal**, HUD de jogo em tempo real, **Painel de Pausa**, **Modal de Histórico de Partidas** e a **Tela de Game Over**.
- **PixiJS (`GameEngine.ts`):** Responsável por gerir o ciclo de renderização gráfica (_Game Loop_), o carregamento de texturas através do `Assets` manager, o tratamento de inputs por teclado, a gestão de entidades (jogador, inimigos, projéteis e explosões) e o sistema de detecção de colisões.
- **Sincronização:** Para evitar re-renderizações desnecessárias da árvore do React a cada frame (o que causaria quedas drásticas de desempenho a 60 FPS), o estado contínuo do combate (pontuação, vida do jogador e temporizador) é gerido na simulação do PixiJS e enviado para a interface de forma otimizada apenas quando ocorrem alterações relevantes ou através de _callbacks_ controlados.

---

## 2. Ciclo de Simulação Baseada em Tempo (`deltaMS`)

Para garantir que o comportamento do jogo seja consistente independentemente da taxa de atualização do monitor do utilizador:

- O motor de jogo (`GameEngine`) utiliza o parâmetro `deltaMS` fornecido pelo `Ticker` do PixiJS em cada frame.
- Todas as operações de movimentação, velocidade dos projéteis, _cooldowns_ de ataque e contagem regressiva do temporizador da partida são multiplicadas por este fator de tempo, garantindo que a física e a simulação correm de forma independente de quedas pontuais de FPS.
- **Pausa e Foco:** Quando o jogo é pausado manualmente (tecla `P`/`ESC`) ou perde o foco da janela, o ciclo do _Ticker_ é interrompido ou ignorado, suspendendo temporariamente os cronômetros e o movimento sem acumular deltas indesejados ao retomar.

---

## 3. Gestão de Recursos e Otimização de Desempenho

- **Object Pooling:** Implementado de forma nativa para gerir os projéteis e as explosões. Os objetos visuais são pré-instanciados ou reutilizados a partir de piscinas ativas/inativas, evitando a criação excessiva de novas instâncias em tempo de execução e eliminando travamentos provocados pelo _Garbage Collector_ do JavaScript durante o combate intenso.
- **Ciclo de Vida (`onDestroy`):** Ao sair de uma partida, reiniciar ou desmontar o componente de jogo, todos os _listeners_ de eventos globais de teclado, instâncias do PixiJS, animações do _Ticker_ e timers ativos são rigorosamente limpos e destruídos para prevenir fugas de memória (_memory leaks_).

---

## 4. Estratégia de Dados: Axios, TanStack Query e MSW

A camada de dados foi arquitetada para simular um ambiente de produção real com robustez e resiliência:

- **MSW (Mock Service Worker):** Interceta as requisições HTTP (`GET` e `POST` em `/api/scores`) diretamente na camada de rede. Funciona de forma transparente tanto em ambiente de desenvolvimento local quanto no pacote compilado para produção na Vercel.
- **Axios:** Utilizado como o cliente HTTP tipado (`apiClient`) para padronizar os cabeçalhos e a comunicação com os endpoints simulados.
- **TanStack Query (`useQuery` / `useMutation`):**
  - Gere o cache, o estado de carregamento (`isPending`), o sucesso e a invalidação automática de consultas (`refetch`).
  - Garante que, ao concluir uma partida, o registo seja submetido e as abas de **Top 3 Ranking** e **Match History (Últimos 10)** sejam atualizadas dinamicamente sem bloquear a experiência do utilizador.
- **Persistência Local:** O _High Score_ pessoal é armazenado de forma síncrona no `localStorage`, assegurando que o recorde do jogador é preservado mesmo após atualizar a página (_refresh_).

---

## 5. Limitações Conhecidas e Decisões de Balanceamento

- **Limitação do MSW no Browser:** O _Service Worker_ requer que a aplicação seja servida a partir de um servidor web (como o Vite em dev ou o ambiente estático da Vercel), não funcionando adequadamente se o ficheiro `index.html` for aberto diretamente via protocolo `file://` local.
- **Balanceamento de Combate:** O intervalo de _spawn_ dos inimigos (Chasers e Shooters) e a vida do jogador foram calibrados para proporcionar uma sessão dinâmica de 60 segundos, equilibrando o desafio de manobra em áreas restritas por ilhas com a responsividade dos disparos frontais e laterais.
