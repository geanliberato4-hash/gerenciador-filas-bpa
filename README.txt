GERENCIADOR DE FILAS • BPA
==========================

TELAS
- index.html            Menu inicial
- senha.html/dados.html Totem: o motorista escolhe o atendimento e tira a senha (sem login)
- chamada.html          TV: mostra e fala as chamadas (som sempre ligado, sem opção de desligar)
- abrir-tela-chamada.bat  Abre a TV em tela cheia com o som liberado (usar no computador da TV)
- atendente.html        Painel do atendente

DADOS (Firebase Realtime Database)
- unidades/BPA/filas      filas exibidas no painel   { chave: { nome, ativa } }
- unidades/BPA/senhas     senhas aguardando/chamando
- unidades/BPA/historico  atendimentos finalizados/cancelados

HISTÓRICO
- Atendimentos encerrados há mais de 7 dias são apagados automaticamente
  pelo painel do atendente (ao abrir e a cada hora).
- Para mudar o prazo: js/atendente.js, constante DIAS_HISTORICO.

REGRAS DE SEGURANÇA
- O arquivo database.rules.json tem as regras do banco.
- Para aplicar: Firebase Console > Realtime Database > Regras > colar o conteúdo > Publicar.
- O que elas garantem (o sistema não usa login, então a proteção é parcial):
  * Ninguém consegue apagar ou substituir o banco inteiro de uma vez.
  * Filas só podem ser alteradas pelo console do Firebase.
  * Senha nova só entra como "aguardando", com placa válida, fila existente
    e sem campos extras (ninguém consegue "chamar" uma senha falsa na TV ao criá-la).
  * Nada pode ser gravado fora de unidades/BPA.
