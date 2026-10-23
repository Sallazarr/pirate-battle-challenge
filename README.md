# 🏴‍☠️ Pirate Battle

Um jogo de combate naval desenvolvido em **React, TypeScript e PixiJS**, criado como parte de uma avaliação técnica focada em desempenho, gestão de memória, arquitetura de componentes e integração com serviços mockados (`MSW` e `TanStack Query`).

---

## 🎮 Como Jogar & Controlos

Sobreviva às vagas de navios inimigos durante 60 segundos defendendo a sua posição nas águas da fortaleza!

- **W / Seta Acima:** Navegar para a frente (o navio move-se na direção do nariz).
- **A, D / Setas Esquerda e Direita:** Rodar o navio.
- **ESPAÇO:** Disparo de canhão frontal.
- **Q / E:** Disparos laterais (Bordadas a bombordo e estibordo).
- **P / ESC:** Pausar o jogo.

---

## 🚀 Como Executar Localmente

Certifique-se de que tem o **Node.js** instalado na sua máquina.

1. Clone o repositório e instale as dependências:
   ```bash
   npm install
   ```
   Inicie o servidor de desenvolvimento:

Bash
npm run dev
Abra o endereço indicado no seu navegador (geralmente http://localhost:5173).

🛠️ Decisões Técnicas e Arquitetura
PixiJS + React: O React gere a interface de utilizador (Menus, HUD de Jogo, Painel de Pausa, Janela de Histórico e ecrã de Game Over), enquanto o PixiJS gere o ciclo de renderização gráfica de alta performance (Game Loop).

Object Pooling: Implementado no motor de jogo para projéteis e explosões, eliminando a criação excessiva de objetos em tempo de execução e evitando picos de pausas provocados pelo Garbage Collector.

Gestão de Estado & API Mocks: Integração com Axios e TanStack Query para submissão e listagem de recordes, interceptados de forma transparente em desenvolvimento e produção através do MSW (Mock Service Worker).

Relógio Baseado no Ticker: O cronómetro da partida utiliza o deltaMS do motor gráfico, garantindo que o tempo pausa corretamente quando o jogo é interrompido, prevenindo dessincronizações.
