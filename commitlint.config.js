module.exports = {
  extends: ['@commitlint/config-conventional'],
  parserPreset: {
    parserOpts: {
      // Adapte o padrão conforme o prefixo do seu ticket tracker
      // Exemplo: TN-123 (TerapiaNutricional)
      headerPattern: /^(\w+)(\(TN-[0-9]+\))?:[ ](.+)$/,
    },
  },
  rules: {
    'scope-case': [0],
  },
};
