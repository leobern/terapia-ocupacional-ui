const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Adicione seus mocks de API aqui
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// ---------------------------------------------------------------------------
// Mocks da tela Home (specs/003-home) — caminho feliz (contagem, indicador,
// paginação). O cenário de erro (FR-013) é simulado no próprio teste
// Playwright via interceptação de rota (page.route), não aqui — ver
// e2e/src/step-definitions/home.steps.ts.
// ---------------------------------------------------------------------------

const HOSPITALS = [{ id: 1, name: 'Hospital Vila Nova Star' }];

function buildNotification(id) {
  return {
    id,
    author: {
      id: 100 + id,
      name: id % 2 === 0 ? 'Jairo Nepomuceno' : 'Filippa Martins',
      specialty: id % 2 === 0 ? 'Farmacêutico' : 'Nutricionista',
      photoUrl: null,
    },
    description: `Notificação de teste número ${id}, usada para validar o E2E da Home.`,
    createdAt: new Date(Date.now() - id * 60000).toISOString(),
    read: false,
  };
}

app.get('/v1/home/hospitals', (_req, res) => {
  res.json(HOSPITALS);
});

app.get('/v1/home/summary', (_req, res) => {
  res.json({
    patientCount: 10,
    nutritionalGoalIndicator: {
      caloricPercentage: 80,
      caloricStatus: 'NORMAL',
      proteinPercentage: 70,
      proteinStatus: 'NORMAL',
    },
    unreadNotificationCount: 3,
  });
});

app.get('/v1/home/notifications', (req, res) => {
  const cursor = req.query.cursor;
  if (!cursor) {
    res.json({ items: [1, 2, 3].map(buildNotification), nextCursor: 'page-2' });
    return;
  }
  res.json({ items: [4, 5].map(buildNotification), nextCursor: null });
});

app.listen(PORT, () => {
  console.error(`Mock API server running on port ${PORT}`);
});
