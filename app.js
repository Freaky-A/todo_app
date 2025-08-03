const express = require('express');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

const PAGE_SIZE = 10;

let todos = [];
let errorMessage = null;

if (fs.existsSync('todos.json')) {
    const raw = fs.readFileSync('todos.json', 'utf8');
    if (raw.trim()) todos = JSON.parse(raw);
}

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// 共通：カテゴリ一覧作成
function getCategories() {
    return [...new Set(todos.map(t => t.category))];
}

// 共通：ページング処理（定数使用）
function paginate(array, currentPage) {
    const totalPages = Math.max(1, Math.ceil(array.length / PAGE_SIZE));
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const paged = array.slice(startIndex, startIndex + PAGE_SIZE);
    return { paged, totalPages };
}

// 共通：クエリ再構築（EJS用ヘルパー）
function buildQuery(filters, sortKey, page) {
    const params = new URLSearchParams();
    if (filters.q) params.append('q', filters.q);
    if (filters.category) params.append('category', filters.category);
    if (filters.status) params.append('status', filters.status);
    if (sortKey) params.append('key', sortKey);
    params.append('page', page);
    return params.toString();
}

// ホーム表示
app.get('/', (req, res) => {
    const currentPage = parseInt(req.query.page) || 1;
    const { paged, totalPages } = paginate(todos, currentPage);

    res.render('index', {
        todos: paged,
        errorMessage,
        categories: getCategories(),
        sortKey: null,
        currentPage,
        totalPages,
        filters: {},
        buildQuery
    });
    errorMessage = null; // 表示が終わったら消す
});

// タスク追加
app.post('/add', (req, res) => {
    const taskName = req.body.task.replace(/\r?\n/g, '').trim();
    const category = (req.body.category || '未分類').replace(/\r?\n/g, '').trim();
    const dueDate = req.body.dueDate || '';

    if (!taskName) {
        errorMessage = 'タスク名は必須です。';
        return res.redirect('/');
    }
    
    const newTodo = {
        task: taskName,
        done: false,
        category,
        dueDate,
        completedAt: null, // 初期状態
    };

    todos.push(newTodo);
    fs.writeFileSync('todos.json', JSON.stringify(todos, null, 2), 'utf8');
    res.redirect('/');
});

// チェック切り替え
app.post('/toggle', (req, res) => {
    const index = parseInt(req.body.index);
    const todo = todos[index];

    if (todo) {
        todo.done = !todo.done;
        todo.completedAt = todo.done ? new Date().toISOString().split('T')[0] : null;
        fs.writeFileSync('todos.json', JSON.stringify(todos, null, 2), 'utf8');
    }

    res.redirect('/');
})

// タスク削除
app.post('/delete', (req, res) => {
    const index = parseInt(req.body.index);
    todos.splice(index, 1);
    fs.writeFileSync('todos.json', JSON.stringify(todos, null, 2), 'utf8');
    res.redirect('/');
});

// 検索
app.get('/search', (req, res) => {
    const keyword = req.query.q || '';
    const currentPage = parseInt(req.query.page) || 1;
    const filtered = todos.filter(todo => todo.task.includes(keyword));
    const { paged, totalPages } = paginate(filtered, currentPage);

    res.render('index', {
        todos: paged,
        errorMessage: null,
        categories: getCategories(),
        sortKey: null,
        currentPage,
        totalPages,
        filters: { q: keyword },
        buildQuery
    });
});

// フィルター
app.get('/filter', (req, res) => {
    const { category, status } = req.query;
    const currentPage = parseInt(req.query.page) || 1;

    const filtered = todos.filter(todo => {
        const matchCategory = category ? todo.category === category : true;
        const matchStatus =
            status === 'done' ? todo.done :
            status === 'undone' ? !todo.done :
            true;
        return matchCategory && matchStatus;
    });

    const { paged, totalPages } = paginate(filtered, currentPage);

    res.render('index', {
        todos: filtered,
        errorMessage: null,
        categories: getCategories(),
        sortKey: null,
        currentPage,
        totalPages,
        filters: { category, status },
        buildQuery
    });
});

// ソート
app.get('/sort', (req, res) => {
    const { key } = req.query;
    const currentPage = parseInt(req.query.page) || 1;

    const sorted = [...todos].sort((a, b) => {
        if (key === 'category') return a.category.localeCompare(b.category);
        if (key === 'dueDate') return (a.dueDate || '').localeCompare(b.dueDate || '');
        if (key === 'completedAt') return (a.completedAt || '').localeCompare(b.completedAt || '');
        return 0;
    });

    const { paged, totalPages } = paginate(sorted, currentPage);

    res.render('index', {
        todos: sorted,
        errorMessage: null,
        categories: getCategories(),
        sortKey: null,
        currentPage,
        totalPages,
        filters: {},
        buildQuery
    });
});

// 編集画面表示
app.get('/edit/:index', (req, res) => {
    const index = parseInt(req.params.index);
    const todo = todos[index];
    if (!todo) return res.redirect('/');
    res.render('edit', { todo, index });
});

// 編集フォーム送信
app.post('/update/:index', (req, res) => {
    const index = parseInt(req.params.index);
    const taskName = req.body.task.replace(/\r?\n/g, '').trim();
    const category = (req.body.category || '未分類').replace(/\r?\n/g, '').trim();
    const dueDate = req.body.dueDate || '';

    if (!taskName) {
        errorMessage = 'タスク名は必須です。';
        return res.redirect('/');
    }

    todos[index].task = taskName;
    todos[index].category = category;
    todos[index].dueDate = dueDate;

    fs.writeFileSync('todos.json', JSON.stringify(todos, null, 2), 'utf8');
    res.redirect('/');
});

// 起動
app.listen(PORT, () => {
    console.log(`http://localhost:${PORT} で起動中`);
});
