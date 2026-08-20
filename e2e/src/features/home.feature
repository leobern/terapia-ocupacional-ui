# language: pt

Funcionalidade: Home
  Como profissional de saúde
  Quero ver a contagem de pacientes do dia e minhas notificações ao abrir o app
  Para organizar meu dia sem precisar navegar para outra tela

  Cenário: Ver a contagem de pacientes e as notificações ao abrir a Home
    Dado que a Home carrega com sucesso
    Quando eu abro a tela Home
    Então vejo o card de contagem com "10 Pacientes"
    E vejo pelo menos 1 card de notificação

  Cenário: Carregar mais notificações ao rolar até o final da lista
    Dado que a Home carrega com sucesso
    Quando eu abro a tela Home
    E rolo até o final da lista de notificações
    Então um novo lote de notificações é carregado automaticamente

  Cenário: Mostrar erro genérico quando o carregamento inicial falha
    Dado que a Home falha ao carregar
    Quando eu abro a tela Home
    Então vejo a mensagem "Erro ao carregar os dados"
    E vejo o botão "Tentar novamente"
