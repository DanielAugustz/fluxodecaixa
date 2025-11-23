// Configuração do Supabase (Use suas chaves reais aqui)
const SUPABASE_URL = 'https://hgpbonozwaqfdumuvvzf.supabase.co/'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhncGJvbm96d2FxZmR1bXV2dnpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4NTczOTAsImV4cCI6MjA3OTQzMzM5MH0.u0NsiQ9izASLjLoqRlzozZCOXGx_CQphXdcfEFmzZKA'; 
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const authForm = document.getElementById('auth-form');
const authEmailInput = document.getElementById('auth-email');
const authPasswordInput = document.getElementById('auth-password');
const authMessage = document.getElementById('auth-message');

/**
 * Trata o Login e o Registro
 */
async function handleAuth(type) {
    const email = authEmailInput.value;
    const password = authPasswordInput.value;
    authMessage.textContent = 'Processando...';
    
    let response;
    
    if (type === 'login') {
        response = await supabase.auth.signInWithPassword({ email, password });
    } else if (type === 'signup') {
        response = await supabase.auth.signUp({ email, password });
    }

    if (response.error) {
        authMessage.textContent = `Erro: ${response.error.message}`;
        console.error(response.error);
    } else {
        if (type === 'signup') {
            authMessage.textContent = 'Conta criada com sucesso! Por favor, faça o login.';
        } else {
            // AÇÃO CRUCIAL: Redireciona para a página principal após o login
            window.location.href = 'index.html'; 
        }
    }
}

// 1. Verifica o estado da sessão ao carregar a página de login
supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
        // Se o usuário já estiver logado, redireciona imediatamente
        window.location.href = 'index.html';
    }
});

// 2. Listeners de Autenticação
authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleAuth('login');
});

document.getElementById('btn-signup').addEventListener('click', () => {
    handleAuth('signup');
});