let filaSelecionada = null;

/* ================= CARREGAR FILAS ================= */
db.ref(`unidades/${UNIDADE}/filas`).on("value", snapshot => {
  const container = document.getElementById("listaFilas");
  container.innerHTML = "";

  if (!snapshot.exists()) {
    container.innerHTML = "<p>Nenhum atendimento disponível</p>";
    return;
  }

  snapshot.forEach(child => {
    const fila = child.val();
    if (!fila || !fila.ativa) return;

    const btn = document.createElement("button");
    btn.className = "btn-fila";
    btn.innerText = fila.nome;

    btn.onclick = () => {
      filaSelecionada = child.key; // ✅ ID da fila
      document.getElementById("formSenha").style.display = "flex";
    };

    container.appendChild(btn);
  });
});

/* ================= GERAR SENHA ================= */
function gerarSenha() {
  const nome = document.getElementById("nome").value.trim();
  const placa = document.getElementById("placa").value.trim();

  if (!nome || !placa || !filaSelecionada) return;

  const senha = {
    nome,
    placa,
    atendimento: filaSelecionada, // ✅ PADRÃO ÚNICO
    status: "aguardando",
    criadoEm: firebase.database.ServerValue.TIMESTAMP;
  };

  // 🔐 CAMINHO CORRETO
  db.ref(`unidades/${UNIDADE}/senhas`).push(senha).then(() => {
    document.getElementById("nome").value = "";
    document.getElementById("placa").value = "";
    document.getElementById("formSenha").style.display = "none";
    filaSelecionada = null;
  });
}

