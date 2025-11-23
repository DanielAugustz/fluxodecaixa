// 1. Configuração do Supabase
// **ATENÇÃO: Substitua pelos seus valores reais!**
const SUPABASE_URL = 'https://hgpbonozwaqfdumuvvzf.supabase.co/'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhncGJvbm96d2FxZmR1bXV2dnpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4NTczOTAsImV4cCI6MjA3OTQzMzM5MH0.u0NsiQ9izASLjLoqRlzozZCOXGx_CQphXdcfEFmzZKA'; 
// CORREÇÃO: Usa 'window.supabase' para inicializar o cliente corretamente.
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Referências aos elementos HTML
const btnLogout = document.getElementById('btn-logout');
const userEmailDisplay = document.getElementById('user-email-display');
// 🚨 NOVO: Referência do botão Dark Mode
const themeToggleBtn = document.getElementById('theme-toggle'); 

const listaTransacoes = document.getElementById('lista-transacoes');
const saldoElement = document.getElementById('saldo');
const formTransacao = document.getElementById('form-transacao');
const descricaoInput = document.getElementById('descricao');
const valorInput = document.getElementById('valor');
const btnEntrada = document.getElementById('btn-entrada');
const btnSaida = document.getElementById('btn-saida');
const ctx = document.getElementById('gastosPizzaChart').getContext('2d'); 
const btnExportar = document.getElementById('btn-exportar');
const filtroMesAnoInput = document.getElementById('filtroMesAno');
const btnResetFiltro = document.getElementById('btn-reset-filtro');

let gastosPizzaChart; 

// ===========================================
// FUNÇÕES DE DARK MODE
// ===========================================

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    if (themeToggleBtn) {
        themeToggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
}

// 🚨 INICIALIZAÇÃO DO TEMA AO CARREGAR
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
    applyTheme(savedTheme);
} else {
    // Caso não haja tema salvo, aplica o light
    applyTheme('light'); 
}

// ===========================================
// FUNÇÕES DE AUTENTICAÇÃO E INICIALIZAÇÃO
// ===========================================

/**
 * Trata o Logout e redireciona para a tela de login.
 */
async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
}

/**
 * FUNÇÃO DE PROTEÇÃO: Verifica se o usuário está logado.
 */
async function checkAuthAndInit() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        window.location.href = 'login.html';
        return;
    }
    
    userEmailDisplay.textContent = session.user.email;
    carregarTransacoes(); 
}

// ===========================================
// FUNÇÕES CRUD 
// ===========================================

/**
 * Deleta uma transação pelo ID e recarrega a lista
 */
async function deletarTransacao(id) {
    const { data: { user } } = await supabase.auth.getUser();
    const user_id = user?.id;
    
    if (!user_id) return; 

    if (!confirm('Tem certeza que deseja apagar esta transação?')) {
        return; 
    }

    const { error } = await supabase
        .from('transacoes')
        .delete()
        .eq('id', id); 

    if (error) {
        console.error('Erro ao deletar transação:', error.message);
        alert('Erro ao deletar transação. Verifique o console.');
        return;
    }
    
    carregarTransacoes(filtroMesAnoInput.value); 
}


/**
 * Função assíncrona para buscar, exibir e calcular o saldo e gráfico.
 */
async function carregarTransacoes(filtroMesAno = null) {
    const { data: { user } } = await supabase.auth.getUser();
    const user_id = user?.id;
    
    if (!user_id) return; 

    let query = supabase
        .from('transacoes')
        .select('*');
        
    // Lógica do Filtro de Mês/Ano
    if (filtroMesAno) {
        const dataInicio = `${filtroMesAno}-01`;
        const [ano, mes] = filtroMesAno.split('-').map(Number);
        const proximoMes = (mes === 12) ? 1 : mes + 1;
        const proximoAno = (mes === 12) ? ano + 1 : ano;
        const dataFim = `${proximoAno}-${String(proximoMes).padStart(2, '0')}-01`;

        query = query.gte('data', dataInicio) 
                     .lt('data', dataFim);
    }

    const { data: transacoes, error } = await query
        .order('data', { ascending: false }); 

    if (error) {
        console.error('Erro ao carregar transações:', error.message);
        listaTransacoes.innerHTML = `<li>Erro ao carregar: ${error.message}</li>`;
        return;
    }
    
    listaTransacoes.innerHTML = ''; 
    let saldo = 0;
    let totalEntradas = 0;
    let totalSaidas = 0;
    

    transacoes.forEach(transacao => {
        const li = document.createElement('li');
        const valorFormatado = new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(transacao.valor);
        
        let tipoClasse = '';
        
        // Cálculo do saldo e acumulação para o gráfico
        if (transacao.tipo === 'entrada') {
            saldo += transacao.valor;
            totalEntradas += transacao.valor; 
            tipoClasse = 'entrada';
        } else if (transacao.tipo === 'saida') {
            saldo -= transacao.valor;
            totalSaidas += transacao.valor; 
            tipoClasse = 'saida';
        }
        
        // Montagem do item da lista
        li.classList.add(tipoClasse); 
        li.innerHTML = `
            <span>${new Date(transacao.data).toLocaleDateString('pt-BR')}</span>
            <span>${transacao.descricao}</span>
            <strong>${valorFormatado}</strong>
        `;
        
        // Criação e adição do botão de apagar
        const btnDeletar = document.createElement('button');
        btnDeletar.textContent = 'Apagar';
        btnDeletar.classList.add('btn-deletar');
        btnDeletar.addEventListener('click', () => deletarTransacao(transacao.id));
        
        li.appendChild(btnDeletar);
        listaTransacoes.appendChild(li);
    });

    // Atualização do saldo total
    const saldoFormatado = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(saldo);

    saldoElement.textContent = saldoFormatado;

    // CHAMA A FUNÇÃO DE GRÁFICO DE PIZZA
    atualizarGraficoPizza(totalEntradas, totalSaidas);
}

/**
 * Adiciona uma nova transação ('entrada' ou 'saida') ao Supabase.
 */
async function adicionarTransacao(tipo) {
    const { data: { user } } = await supabase.auth.getUser();
    const user_id = user?.id;

    if (!user_id) {
        alert("Você precisa estar logado para adicionar transações.");
        return;
    }

    const descricao = descricaoInput.value.trim();
    const valor = parseFloat(valorInput.value);
    const dataAtual = new Date().toISOString().split('T')[0]; 

    if (!descricao || isNaN(valor) || valor <= 0) { 
        alert('Por favor, preencha a descrição e o valor corretamente.');
        return;
    }

    const novaTransacao = {
        descricao: descricao,
        valor: valor,
        data: dataAtual, 
        tipo: tipo,
        user_id: user_id // Vincula a transação ao usuário logado
    };

    const { error } = await supabase
        .from('transacoes')
        .insert([novaTransacao]);

    if (error) {
        console.error('Erro ao adicionar transação:', error.message);
        alert(`Erro ao adicionar transação: ${error.message}`);
        return;
    }

    formTransacao.reset();
    carregarTransacoes(filtroMesAnoInput.value);
}

// ===========================================
// FUNÇÃO GRÁFICA: PIZZA (Entrada vs. Saída)
// ===========================================

/**
 * Inicializa ou atualiza o Gráfico de PIZZA para balancear Entradas e Saídas.
 */
function atualizarGraficoPizza(totalEntradas, totalSaidas) { 
    if (gastosPizzaChart) {
        gastosPizzaChart.destroy();
    }
    
    const ctx = document.getElementById('gastosPizzaChart').getContext('2d');
    
    // TOTAIS E CORES FIXAS
    const labels = ['Entradas', 'Saídas'];
    const data = [totalEntradas, totalSaidas];
    
    const cores = [
        '#28a745',  // Verde para Entradas
        '#dc3545'   // Vermelho para Saídas
    ];

    gastosPizzaChart = new Chart(ctx, {
        type: 'pie', 
        data: {
            labels: labels,
            datasets: [{
                label: 'Volume Financeiro Total',
                data: data,
                backgroundColor: cores,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: true, 
                    position: 'top'
                },
                title: {
                    display: true,
                    text: 'Volume Financeiro Total (Entradas vs. Saídas)'
                }
            },
            // As opções são mantidas simples para o gráfico de pizza.
        }
    });
}

// ===========================================
// FUNÇÕES DE EXPORTAÇÃO (XLSX / EXCEL)
// ===========================================

async function exportarParaXLSX() {
    const { data: { user } } = await supabase.auth.getUser();
    const user_id = user?.id;
    
    if (!user_id) {
        alert("Você precisa estar logado para exportar transações.");
        return;
    }
    
    const { data: transacoes, error } = await supabase
        .from('transacoes')
        .select('*')
        .order('data', { ascending: false }); 

    if (error || transacoes.length === 0) {
        alert(error ? 'Erro ao exportar. Verifique o console.' : 'Não há transações para exportar.');
        return;
    }

    // 1. Prepara os dados como um Array de Objetos
    const dadosPlanilha = transacoes.map(t => ({
        ID: t.id,
        Data: t.data.substring(0, 10), 
        Tipo: t.tipo.toUpperCase(),
        Descrição: t.descricao,
        'Valor (R$)': t.valor, 
        CriadoEm: t.created_at.substring(0, 10) 
    }));
    
    // 2. Cria a planilha (worksheet)
    const ws = XLSX.utils.json_to_sheet(dadosPlanilha);
    
    // 3. Aplica Formatação e Estilo
    
    const max_width = dadosPlanilha.reduce((w, r) => {
        Object.keys(r).forEach(k => {
            const cellValue = r[k] ? r[k].toString() : '';
            w[k] = Math.max(w[k] || 0, cellValue.length);
        });
        return w;
    }, {});

    const wscols = Object.keys(max_width).map(k => ({
        wch: Math.min(60, Math.max(10, max_width[k] + 2)) 
    }));
    ws['!cols'] = wscols;

    const range = XLSX.utils.decode_range(ws['!ref']);
    const COLUNA_CRIADO_EM = 5; 
    
    for(let R = range.s.r; R <= range.e.r; ++R) {
        const cell_tipo_address = R > 0 ? XLSX.utils.encode_cell({r:R, c:2}) : null; 
        const tipo_valor = R > 0 && ws[cell_tipo_address] ? ws[cell_tipo_address].v : '';
        
        let cor_fundo = '';
        if (tipo_valor === 'ENTRADA') {
            cor_fundo = "FFCCFFCC"; 
        } else if (tipo_valor === 'SAIDA') {
            cor_fundo = "FFFFCCCC"; 
        } else {
            cor_fundo = "FF888888"; 
        }
        
        for(let C = range.s.c; C <= range.e.e; ++C) {
            const cell_address = XLSX.utils.encode_cell({r:R, c:C});
            if (!ws[cell_address]) {
                ws[cell_address] = { v: null }; 
            }
            if (!ws[cell_address].s) ws[cell_address].s = {};

            ws[cell_address].s.alignment = { horizontal: "center", vertical: "center" };

            ws[cell_address].s.fill = { fgColor: { rgb: cor_fundo } };

            if (R === 0) {
                ws[cell_address].s.fill = { fgColor: { rgb: "FF888888" } }; 
                ws[cell_address].s.font = { bold: true, color: { rgb: "FFFFFFFF" } }; 
                ws[cell_address].s.alignment = { horizontal: "center" };
            }
            
            if (C === 4 && R > 0) {
                ws[cell_address].z = 'R$ #,##0.00'; 
            }
            
            if (C === COLUNA_CRIADO_EM) {
                ws[cell_address].t = 's'; 
                ws[cell_address].z = '@'; 
            }
        }
    }
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fluxo de Caixa");

    const nomeArquivo = `fluxo_de_caixa_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, nomeArquivo);

    alert('Dados exportados para XLSX com sucesso!');
}


// 6. Configuração dos Listeners de Eventos
if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme); // 🚨 Dark Mode Listener
}

btnLogout.addEventListener('click', handleLogout);

btnEntrada.addEventListener('click', () => adicionarTransacao('entrada'));
btnSaida.addEventListener('click', () => adicionarTransacao('saida'));
btnExportar.addEventListener('click', exportarParaXLSX); 

filtroMesAnoInput.addEventListener('change', (e) => {
    carregarTransacoes(e.target.value); 
});

btnResetFiltro.addEventListener('click', () => {
    filtroMesAnoInput.value = ''; 
    carregarTransacoes(); 
});


// Chamada de inicialização 
checkAuthAndInit();