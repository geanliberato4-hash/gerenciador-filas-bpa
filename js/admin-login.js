/* =========================================================
   LOGIN DO ADMINISTRADOR
   ========================================================= */
const auth = firebase.auth();
const form = document.getElementById("formLogin");
const emailInput = document.getElementById("email");
const senhaInput = document.getElementById("senha");
const btnEntrar = document.getElementById("btnEntrar");
const btnEsqueci = document.getElementById("btnEsqueci");
const msg = document.getElementById("msg");

// Já logado? Vai direto para a administração
auth.onAuthStateChanged(user => {
  if (user) location.replace("admin.html");
});

function mostrarMensagem(texto, ok = false) {
  msg.textContent = texto;
  msg.style.display = "block";
  msg.classList.toggle("msg-ok", ok);
}

function traduzirErro(err) {
  const c = err && err.code ? err.code : "";
  if (c.includes("invalid-email")) return "E-mail inválido.";
  if (c.includes("user-disabled")) return "Este usuário foi desativado.";
  if (c.includes("too-many-requests")) return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  if (c.includes("network")) return "Sem conexão com a internet.";
  if (c.includes("operation-not-allowed")) return "O login por e-mail ainda não foi ativado no Firebase.";
  if (c.includes("wrong-password") || c.includes("user-not-found") || c.includes("invalid-credential") || c.includes("invalid-login"))
    return "E-mail ou senha incorretos.";
  return "Não foi possível entrar. Tente novamente.";
}

form.addEventListener("submit", e => {
  e.preventDefault();
  const email = emailInput.value.trim();
  const senha = senhaInput.value;

  if (!email || !senha) {
    mostrarMensagem("Preencha e-mail e senha.");
    return;
  }

  btnEntrar.disabled = true;
  btnEntrar.textContent = "Entrando…";

  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => auth.signInWithEmailAndPassword(email, senha))
    .then(() => location.replace("admin.html"))
    .catch(err => {
      console.error(err);
      mostrarMensagem(traduzirErro(err));
      btnEntrar.disabled = false;
      btnEntrar.textContent = "Entrar";
      senhaInput.select();
    });
});

btnEsqueci.addEventListener("click", () => {
  const email = emailInput.value.trim();
  if (!email) {
    mostrarMensagem("Digite seu e-mail acima e clique de novo em \"Esqueci minha senha\".");
    emailInput.focus();
    return;
  }
  auth.sendPasswordResetEmail(email)
    .then(() => mostrarMensagem("Se este e-mail estiver cadastrado, você receberá um link para criar uma nova senha.", true))
    .catch(err => mostrarMensagem(traduzirErro(err)));
});
