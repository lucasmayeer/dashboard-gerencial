<div align="center">

# 📊 Dashboard Gerencial

**[🇧🇷 Português](#português) · [🇺🇸 English](#english)**

Plataforma gerencial multimódulo desenvolvida para a **Odoo BR**  
como iniciativa paralela de dois colaboradores — hoje em uso ativo em produção.

![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Recharts](https://img.shields.io/badge/Recharts-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white)

</div>

---

<a name="português"></a>

## 🇧🇷 Português

### Sobre o projeto

Dashboard gerencial desenvolvido para a **Odoo BR** — empresa de implementação e consultoria Odoo no Brasil. O projeto nasceu **fora do horário de trabalho**, como uma iniciativa paralela e não oficial de dois colaboradores que identificaram um problema real e decidiram resolvê-lo.

Tudo começou com um módulo de **Gestão de Custos (Facilities)** — simples, focado, desenvolvido para dar visibilidade aos gastos operacionais da empresa. Os resultados foram tão expressivos que o projeto escalou organicamente para outros dois departamentos: **Vendas** e **Implantação**. Com o crescimento, toda a infraestrutura foi estruturada para rodar de forma dedicada — servidor local da empresa, banco de dados Supabase configurado do zero e serviço próprio para garantir disponibilidade contínua.

Hoje, três departamentos inteiros utilizam o sistema como base para suas decisões.

> **⚠️ Portfólio:** O código e todos os dados exibidos nesta versão são **fictícios**.  
> O case real é de uso confidencial e permanece em produção na Odoo BR.  
> [🔗 Acessar demonstração](#) <!-- adicionar link do deploy -->

---

### O problema que motivou o projeto

Antes do dashboard, os três departamentos operavam com dados completamente fragmentados:

- Planilhas desconexas sem consolidação centralizada
- Nenhuma visualização de KPIs ou métricas unificadas
- Decisões tomadas com base em feeling, sem histórico estruturado
- Sem acompanhamento de custos operacionais mês a mês
- Consolidação manual que consumia semanas de trabalho a cada período

---

### Impacto gerado

| Indicador | Resultado |
|-----------|-----------|
| ⏱️ Consolidação manual | Redução de **~1 semana/mês** nos departamentos de Vendas e Implantação |
| 💰 Custos operacionais | Queda de **70%** de um ano para o outro — acompanhada e visível via módulo Facilities |
| 👥 Adoção | **3 departamentos** e **70+ colaboradores** passaram a basear decisões em dados reais |
| 🚀 Status | Em uso ativo pela Odoo BR até hoje |

---

### Módulos

#### 📦 Gestão de Custos — Facilities
O módulo que deu início ao projeto. Controle completo dos gastos operacionais da empresa.

- Acompanhamento de custos por categoria e fornecedor, mês a mês
- Visão temporal com tendência e evolução acumulada
- Controle de estoque com classificação em 10 categorias
- Identificação automática de outliers e inconsistências de dados
- Download de NF-e e validações de confiabilidade por fornecedor

#### 📈 Departamento de Vendas — Direct Sales
Performance individual e de time do departamento comercial.

- KPIs de MRR e NRR por vendedor, time e empresa
- Ranking mensal com histórico comparativo entre períodos
- Análise de tendência, consistência e volatilidade individual
- Painel do gestor com picture mode e visão analítica geral
- Cálculo de comissão por tipo de plano (MRR / NRR)
- **TV Mode** — tela de prévia em tempo real para exibição em monitores

#### 🔧 Departamento de Implantação — BSA
Acompanhamento de horas faturáveis e performance dos analistas de implantação.

- Horas faturáveis diárias e mensais por analista e time
- Ritmo do departamento vs. meta do mês com filtro por dia
- Ranking de performance e streak de horas faturáveis
- Gráfico acumulado de horas do departamento ao longo do tempo
- Painel trimestral e anual por analista e gestor de time

---

### Infraestrutura

O projeto foi estruturado para rodar de forma dedicada dentro da empresa:

- **Servidor local** configurado para hospedar a aplicação em rede interna
- **Banco de dados Supabase** configurado do zero com autenticação, Row Level Security e views customizadas
- **Serviço dedicado** para garantir disponibilidade contínua sem dependência de máquinas individuais
- Acesso controlado por departamento com autenticação via Supabase Auth

---

### Stack técnica

| Camada | Tecnologia |
|--------|-----------|
| UI Framework | React 18 + TypeScript |
| Build | Vite + Bun |
| Estilização | Tailwind CSS + shadcn/ui (Radix UI primitives) |
| Gráficos | Recharts |
| Animações | Framer Motion |
| Backend / Auth | Supabase (PostgreSQL + Row Level Security) |
| Roteamento | React Router v6 |
| Testes | Vitest + jsdom |

---

### Autores

Projeto concebido, desenvolvido e colocado em produção integralmente por:

<table>
  <tr>
    <td align="center" width="300">
      <b>Lucas Mayer</b><br/>
      Office Manager · Odoo BR<br/>
      <a href="https://www.linkedin.com/in/lucasmayer00">LinkedIn →</a>
    </td>
    <td align="center" width="300">
      <b>Rodrigo Marba</b><br/>
      Team Leader, Business System Analyst · Odoo BR<br/>
      <a href="https://www.linkedin.com/in/rodrigomarba">LinkedIn →</a>
    </td>
  </tr>
</table>

---

<a name="english"></a>

## 🇺🇸 English

### About

A multi-module management dashboard built for **Odoo BR** — an Odoo implementation and consulting company in Brazil. The project was born **outside working hours**, as an unofficial side initiative by two employees who identified a real problem and decided to solve it themselves.

It started as a single **Cost Management (Facilities)** module — focused and straightforward, built to give visibility into the company's operational expenses. The results were significant enough that the project organically scaled to two more departments: **Sales** and **Implementation**. As it grew, the full infrastructure was set up to run in a dedicated environment — a local company server, a Supabase database configured from scratch, and a dedicated service to ensure continuous availability.

Today, three entire departments use the system as the foundation for their decisions.

> **⚠️ Portfolio notice:** All code and data in this version are **fictitious**.  
> The real case is confidential and remains in production at Odoo BR.  
> [🔗 Live demo](#) <!-- add deploy link here -->

---

### The problem

Before this dashboard, all three departments operated with completely fragmented data:

- Disconnected spreadsheets with no central consolidation
- No unified KPI or metric visualization
- Decisions made by gut feeling, with no structured historical data
- No operational cost tracking month over month
- Manual consolidation consuming weeks of work each period

---

### Impact

| Metric | Result |
|--------|--------|
| ⏱️ Manual consolidation | **~1 week/month reduction** across Sales and Implementation departments |
| 💰 Operational costs | **70% decrease** year-over-year — tracked and visible via the Facilities module |
| 👥 Adoption | **3 departments** and **70+ people** now make data-driven decisions |
| 🚀 Status | Still actively used by Odoo BR today |

---

### Modules

#### 📦 Cost Management — Facilities
The module that started it all. Full control over the company's operational expenses.

- Monthly cost tracking by category and supplier
- Temporal overview with trend and cumulative evolution
- Inventory management with 10-category classification
- Automatic outlier and data inconsistency detection
- NF-e download and supplier reliability validations

#### 📈 Sales Department — Direct Sales
Individual and team performance for the commercial department.

- MRR and NRR KPIs per seller, team, and company
- Monthly ranking with historical period comparison
- Individual trend, consistency, and volatility analysis
- Manager panel with picture mode and general analytics view
- Commission tracking by plan type (MRR / NRR)
- **TV Mode** — real-time preview screen for display on monitors

#### 🔧 Implementation Department — BSA
Billable hours tracking and performance for implementation analysts.

- Daily and monthly billable hours per analyst and team
- Department pace vs. monthly target with day-level filter
- Performance ranking and billable hours streak
- Cumulative department hours chart over time
- Quarterly and annual panels per analyst and team manager

---

### Infrastructure

The project was structured to run in a dedicated environment inside the company:

- **Local server** configured to host the application on the internal network
- **Supabase database** set up from scratch with authentication, Row Level Security, and custom views
- **Dedicated service** ensuring continuous availability without relying on individual machines
- Department-level access control via Supabase Auth

---

### Tech stack

| Layer | Technology |
|-------|-----------|
| UI Framework | React 18 + TypeScript |
| Build | Vite + Bun |
| Styling | Tailwind CSS + shadcn/ui (Radix UI primitives) |
| Charts | Recharts |
| Animations | Framer Motion |
| Backend / Auth | Supabase (PostgreSQL + Row Level Security) |
| Routing | React Router v6 |
| Testing | Vitest + jsdom |

---

### Authors

Entirely conceived, developed, and deployed by:

<table>
  <tr>
    <td align="center" width="300">
      <b>Lucas Mayer</b><br/>
      Office Manager · Odoo BR<br/>
      <a href="https://www.linkedin.com/in/lucasmayer00">LinkedIn →</a>
    </td>
    <td align="center" width="300">
      <b>Rodrigo Marba</b><br/>
      Team Leader, Business System Analyst · Odoo BR<br/>
      <a href="https://www.linkedin.com/in/rodrigomarba">LinkedIn →</a>
    </td>
  </tr>
</table>
