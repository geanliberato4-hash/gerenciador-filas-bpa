let filaSelecionada = null;

db.ref(`unidades/${UNIDADE}/filas`).on("value", snapshot => {
  const container = document.getElementById("listaFilas");
  container.innerHTML = "";

  if (!snapshot.exists()) {
    container.innerHTML = "<p>Nenhum atendimento disponível</p>";
    return;
  }

  snapshot.forEach(child => {
    const fila = child.val();

    if (fila.ativa) {
      const btn = document.createElement("button");
      btn.className = "btn-fila";
      btn.innerText = fila.nome;

      btn.onclick = () => {
        filaSelecionada = fila.nome;
        document.getElementById("formSenha").style.display = "flex";
      };

      container.appendChild(btn);
    }
  });
});

function gerarSenha() {
  const nome = document.getElementById("nome").value.trim();
  const placa = document.getElementById("placa").value.trim();

  if (!nome || !placa || !filaSelecionada) return;

  const senha = {
    nome,
    placa,
    fila: filaSelecionada,
    status: "aguardando",
    unidade: UNIDADE,
    criadoEm: Date.now()
  };

  db.ref("senhas").push(senha).then(() => {
    document.getElementById("nome").value = "";
    document.getElementById("placa").value = "";
    document.getElementById("formSenha").style.display = "none";
    filaSelecionada = null;
  });
}
