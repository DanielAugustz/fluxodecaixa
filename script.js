// 1. Configuração do Supabase
// **ATENÇÃO: Substitua pelos seus valores reais!**
const SUPABASE_URL = 'https://hgpbonozwaqfdumuvvzf.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhncGJvbm96d2FxZmR1bXV2dnpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4NTczOTAsImV4cCI6MjA3OTQzMzM5MH0.u0NsiQ9izASLjLoqRlzozZCOXGx_CQphXdcfEFmzZKA'; 


// CORREÇÃO: Usa 'window.supabase' para inicializar o cliente corretamente.
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Referências aos elementos HTML
const listaTransacoes = document.getElementById('lista-transacoes');
const saldoElement = document.getElementById('saldo');
const formTransacao = document.getElementById('form-transacao');
const descricaoInput = document.getElementById('descricao');
const valorInput = document.getElementById('valor');
const btnEntrada = document.getElementById('btn-entrada');
const btnSaida = document.getElementById('btn-saida');
const ctx = document.getElementById('gastosPizzaChart').getContext('2d'); 
const btnExportar = document.getElementById('btn-exportar');
// A referência ao btnLimpar foi removida do código, assim como sua função.
const filtroMesAnoInput = document.getElementById('filtroMesAno');
const btnResetFiltro = document.getElementById('btn-reset-filtro');

let gastosPizzaChart; 

/**
 * Deleta uma transação pelo ID e recarrega a lista
 */
async function deletarTransacao(id) {
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

    // Aplica ordenação e executa a consulta
    const { data: transacoes, error } = await query
        .order('data', { ascending: false }); 

    if (error) {
        console.error('Erro ao carregar transações:', error.message);
        listaTransacoes.innerHTML = `<li>Erro ao carregar: ${error.message}</li>`;
        return;
    }
    
    listaTransacoes.innerHTML = ''; 
    let saldo = 0;
    const categoriasGastos = {};

    transacoes.forEach(transacao => {
        const li = document.createElement('li');
        const valorFormatado = new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(transacao.valor);
        
        let tipoClasse = '';
        
        // Cálculo do saldo e categorização
        if (transacao.tipo === 'entrada') {
            saldo += transacao.valor;
            tipoClasse = 'entrada';
        } else if (transacao.tipo === 'saida') {
            saldo -= transacao.valor;
            tipoClasse = 'saida';

            const categoria = transacao.descricao || 'Outros Gastos'; 
            if (categoriasGastos[categoria]) {
                categoriasGastos[categoria] += transacao.valor;
            } else {
                categoriasGastos[categoria] = transacao.valor;
            }
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

    // Atualização do gráfico
    atualizarGraficoPizza(categoriasGastos);
}

/**
 * Adiciona uma nova transação ('entrada' ou 'saida') ao Supabase.
 */
async function adicionarTransacao(tipo) {
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
    };

    const { error } = await supabase
        .from('transacoes')
        .insert([novaTransacao]);

    if (error) {
        console.error('Erro ao adicionar transação:', error.message);
        alert('Erro ao adicionar transação. Verifique o console.');
        return;
    }

    formTransacao.reset();
    carregarTransacoes(filtroMesAnoInput.value);
}

// ===========================================
// FUNÇÕES DE EXPORTAÇÃO (XLSX / EXCEL)
// ===========================================

/**
 * Pega todas as transações, formata-as em uma estrutura de planilha e baixa o arquivo XLSX.
 */
async function exportarParaXLSX() {
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
        Data: t.data.substring(0, 10), 
        Tipo: t.tipo.toUpperCase(),
        Descrição: t.descricao,
        'Valor (R$)': t.valor, 
    }));
    
    // 2. Cria a planilha (worksheet)
    const ws = XLSX.utils.json_to_sheet(dadosPlanilha);

    
    // Cálculo e Definição da Largura das Colunas (Autoajuste)
    const max_width = dadosPlanilha.reduce((w, r) => {
        Object.keys(r).forEach(k => {
            const cellValue = r[k] ? r[k].toString() : '';
            w[k] = Math.max(w[k] || 0, cellValue.length);
        });
        return w;
    }, {});

    // Define larguras (incluindo margem)
    const wscols = Object.keys(max_width).map(k => ({
        wch: Math.min(60, Math.max(10, max_width[k] + 2)) 
    }));
    ws['!cols'] = wscols;

    // Formatação de Moeda, Data e Alinhamento
    const range = XLSX.utils.decode_range(ws['!ref']);
    
    const COLUNA_CRIADO_EM = 5; 
    
    for(let R = range.s.r; R <= range.e.r; ++R) {
        
        for(let C = range.s.c; C <= range.e.e; ++C) {
            const cell_address = XLSX.utils.encode_cell({r:R, c:C});
            if (!ws[cell_address]) {
                ws[cell_address] = { v: null }; 
            }
            if (!ws[cell_address].s) ws[cell_address].s = {};

            // 🚨 ALINHAMENTO: Centraliza o conteúdo de TODAS as células
            ws[cell_address].s.alignment = { horizontal: "center", vertical: "center" };

            // Estilo do Cabeçalho (Linha 0)
            if (R === 0) {
                // Remove a cor de fundo do cabeçalho
                // ws[cell_address].s.fill = { fgColor: { rgb: "FF888888" } }; // REMOVIDO
                ws[cell_address].s.font = { bold: true }; // Mantém negrito
                ws[cell_address].s.alignment = { horizontal: "center" };
            }
            
            // Formatação de Moeda (Coluna 'Valor (R$)', index 4)
            if (C === 4 && R > 0) {
                ws[cell_address].z = 'R$ #,##0.00'; 
            }
            
            // Formatação de Texto para a coluna 'CriadoEm' (index 5)
            if (C === COLUNA_CRIADO_EM) {
                ws[cell_address].t = 's'; // Define o tipo da célula como string
                ws[cell_address].z = '@'; // Define o formato do Excel como texto literal
            }
            
            // 🚨 GARANTIA DE SEM COR: Remove qualquer propriedade 'fill' que possa ter sido injetada
            if (ws[cell_address].s.fill) {
                delete ws[cell_address].s.fill;
            }
        }
    }
    
    // 4. Cria o Livro (workbook) e insere a planilha
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fluxo de Caixa");

    // 5. Gera o arquivo binário XLSX e força o download
    const nomeArquivo = `fluxo_de_caixa_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, nomeArquivo);

    alert('Dados exportados para XLSX com sucesso!');
}

/**
 * Inicializa ou atualiza o gráfico de pizza dos gastos.
 */
function atualizarGraficoPizza(categoriasGastos) {
    const labels = Object.keys(categoriasGastos);
    const data = Object.values(categoriasGastos);

    if (gastosPizzaChart) {
        gastosPizzaChart.destroy();
    }

    gastosPizzaChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40',
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
                ],
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'Distribuição dos Gastos'
                }
            }
        }
    });
}


// 6. Configuração dos Listeners de Eventos
btnEntrada.addEventListener('click', () => adicionarTransacao('entrada'));
btnSaida.addEventListener('click', () => adicionarTransacao('saida'));

// Listener agora chama a nova função exportarParaXLSX
btnExportar.addEventListener('click', exportarParaXLSX); 

// Listeners para o Filtro de Mês/Ano
filtroMesAnoInput.addEventListener('change', (e) => {
    carregarTransacoes(e.target.value); 
});

btnResetFiltro.addEventListener('click', () => {
    filtroMesAnoInput.value = ''; // Limpa o campo visual
    carregarTransacoes(); 
});


// Executa o carregamento inicial (sem filtro)
carregarTransacoes();