document.addEventListener('DOMContentLoaded', () => {
    // CẤU HÌNH & KHỞI TẠO
    const STORAGE_KEY = 'GiamThiAI_Data_v1'; // Key lưu trữ
    const VIOLATION_MAP = {
        'KHONG_MANG_THE': { label: 'Không mang thẻ học viên', keys: ['the', 'khong mang the', 'deo the', 'quang the', 'quen the', 'k the', 'ko the'] },
        'KHONG_MAC_AO_DOAN': { label: 'Không mặc áo đoàn', keys: ['ao doan', 'doan', 'aodoan', 'khong mac ao doan', 'k ao doan', 'thieu ao doan'] },
        'DI_XE_50CC': { label: 'Đi xe trên 50cc', keys: ['xe', 'may', '50cc', 'phan khoi', 'xe may', 'xe to'] },
        'NHUOM_TOC': { label: 'Nhuộm tóc / Đầu tóc', keys: ['toc', 'nhuom', 'dau toc', 'toc tai', 'nhuom toc'] },
        'KHONG_DONG_THUNG': { label: 'Không đóng thùng (Sơ vin)', keys: ['thung', 'so vin', 'bo ao', 'khong dong thung', 'dong thung', 'chua so vin'] },
        'KHONG_MAC_AO_DAI': { label: 'Không mặc áo dài', keys: ['ao dai', 'aod', 'khong mac ao dai', 'mac sai ao dai'] },
        'MANG_DEP_LE': { label: 'Mang dép lê', keys: ['dep', 'dep le', 'mang dep', 'di dep', 'le'] },
        'DI_HOC_MUON': { label: 'Đi học muộn', keys: ['muon', 'tre', 'di muon', 'di tre'] },
        'KHONG_TRUC_NHAT': { label: 'Không trực nhật', keys: ['truc nhat', 've sinh', 'quet lop'] }
    };

    let appState = { monitorName: '', monitorClass: '', students: [], history: [] };

    const els = {
        loginScreen: document.getElementById('login-screen'),
        mainApp: document.getElementById('main-app'),
        userNameIn: document.getElementById('user-name-input'),
        userClassIn: document.getElementById('user-class-input'),
        accessBtn: document.getElementById('access-btn'),
        displayName: document.getElementById('display-name'),
        displayClass: document.getElementById('display-class'),
        clock: document.getElementById('realtime-clock'),
        textInput: document.getElementById('text-input'),
        micBtn: document.getElementById('mic-btn'),
        ocrInput: document.getElementById('ocr-input'),
        ocrLoading: document.getElementById('ocr-loading'),
        processBtn: document.getElementById('process-btn'),
        reportContainer: document.getElementById('report-container'),
        exportPngBtn: document.getElementById('export-png-btn'),
        exportExcelBtn: document.getElementById('export-excel-btn'),
        undoBtn: document.getElementById('undo-btn'),
        clearBtn: document.getElementById('clear-btn'),
        excelInput: document.getElementById('excel-input'),
        toast: document.getElementById('toast'),
        opts: {
            date: document.getElementById('opt-date'),
            time: document.getElementById('opt-time'),
            monitor: document.getElementById('opt-monitor'),
            class: document.getElementById('opt-class'),
            code: document.getElementById('opt-code')
        }
    };

    // --- CÁC HÀM XỬ LÝ LƯU TRỮ (AUTO SAVE) ---
    const saveToLocal = () => {
        // Chỉ lưu thông tin cần thiết, không lưu lịch sử undo để nhẹ bộ nhớ
        const dataToSave = {
            monitorName: appState.monitorName,
            monitorClass: appState.monitorClass,
            students: appState.students
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    };

    const loadFromLocal = () => {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                // Khôi phục dữ liệu vào state
                if (parsed.monitorName) appState.monitorName = parsed.monitorName;
                if (parsed.monitorClass) appState.monitorClass = parsed.monitorClass;
                if (parsed.students && Array.isArray(parsed.students)) appState.students = parsed.students;

                // Nếu có dữ liệu đăng nhập, tự động bỏ qua màn hình login
                if (appState.monitorName && appState.monitorClass) {
                    els.userNameIn.value = appState.monitorName;
                    els.userClassIn.value = appState.monitorClass;
                    switchToMainApp(false); // false = không cần animation chậm
                    renderReport();
                    showToast('Khôi phục', 'Đã lấy lại dữ liệu phiên trước.');
                }
            } catch (e) {
                console.error("Lỗi khôi phục dữ liệu cũ", e);
                localStorage.removeItem(STORAGE_KEY);
            }
        }
    };

    // --- LOGIC GIAO DIỆN & XỬ LÝ ---

    setInterval(() => {
        els.clock.textContent = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    }, 1000);

    const checkLogin = () => els.accessBtn.disabled = !(els.userNameIn.value.trim() && els.userClassIn.value.trim());
    els.userNameIn.addEventListener('input', checkLogin);
    els.userClassIn.addEventListener('input', checkLogin);

    const switchToMainApp = (animate = true) => {
        els.displayName.textContent = appState.monitorName;
        els.displayClass.textContent = `Lớp trực: ${appState.monitorClass}`;
        
        if (animate) {
            els.loginScreen.classList.add('opacity-0', 'pointer-events-none');
            setTimeout(() => {
                els.loginScreen.classList.add('hidden');
                els.mainApp.classList.remove('hidden');
                setTimeout(() => els.mainApp.classList.remove('opacity-0'), 50);
            }, 500);
        } else {
            els.loginScreen.classList.add('hidden', 'opacity-0');
            els.mainApp.classList.remove('hidden', 'opacity-0');
        }
    };

    els.accessBtn.addEventListener('click', () => {
        appState.monitorName = els.userNameIn.value.trim();
        appState.monitorClass = els.userClassIn.value.trim();
        saveToLocal(); // Lưu thông tin đăng nhập ngay
        switchToMainApp();
    });

    const showToast = (title, message, type = 'info') => {
        document.getElementById('toast-title').textContent = title;
        document.getElementById('toast-message').textContent = message;
        els.toast.classList.replace(type === 'error' ? 'border-blue-500' : 'border-red-500', type === 'error' ? 'border-red-500' : 'border-blue-500');
        els.toast.classList.remove('translate-x-full');
        setTimeout(() => els.toast.classList.add('translate-x-full'), 3000);
    };

    const toTitleCase = str => str.toLowerCase().replace(/(^|\s)\S/g, l => l.toUpperCase());
    const removeAccents = str => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');

    const detectViolation = (text) => {
        const normalized = removeAccents(text.toLowerCase()).trim();
        for (const code in VIOLATION_MAP) {
            if (VIOLATION_MAP[code].keys.some(key => normalized.includes(key))) return VIOLATION_MAP[code].label;
        }
        return toTitleCase(text);
    };

    const smartParse = (rawText) => {
        const lines = rawText.split(/\n+/);
        const results = [];
        const classRegex = /\b([1-9][0-2]?[a-zA-Z][0-9]{0,2})\b/;

        lines.forEach(line => {
            line = line.trim().replace(/\s+/g, ' ');
            if (!line) return;
            let name = '', className = '', violation = '';
            const classMatch = line.match(classRegex);
            
            if (classMatch) {
                className = classMatch[0].toUpperCase();
                name = line.substring(0, classMatch.index).replace(/[-–]/g, '').trim();
                violation = line.substring(classMatch.index + className.length).replace(/[-–]/g, '').trim();
            } else {
                const parts = line.split(/[-–]/);
                if (parts.length >= 2) {
                    name = parts[0].trim();
                    violation = parts[parts.length - 1].trim();
                    if (parts.length > 2) className = parts[1].trim().toUpperCase();
                } else {
                    name = line;
                    violation = 'Chưa xác định';
                }
            }

            if (name) results.push({ id: Date.now() + Math.random(), name: toTitleCase(name), class: className || '?', violation: detectViolation(violation), time: new Date() });
        });
        return results;
    };

    const handleProcessData = () => {
        if (!els.textInput.value.trim()) return showToast('Lỗi', 'Vui lòng nhập dữ liệu!', 'error');
        appState.history.push([...appState.students]);
        els.undoBtn.disabled = false;
        
        const newStudents = smartParse(els.textInput.value);
        appState.students = [...appState.students, ...newStudents];
        
        saveToLocal(); // Lưu sau khi thêm
        renderReport();
        els.textInput.value = '';
        showToast('Thành công', `Đã thêm ${newStudents.length} học sinh.`);
    };

    els.processBtn.addEventListener('click', handleProcessData);
    els.textInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (els.textInput.value.trim()) handleProcessData(); } });

    if ('webkitSpeechRecognition' in window) {
        const recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'vi-VN';
        let isListening = false;

        recognition.onresult = event => {
            let final = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) if (event.results[i].isFinal) final += event.results[i][0].transcript + '\n';
            if (final) { els.textInput.value += final; els.textInput.scrollTop = els.textInput.scrollHeight; }
        };
        recognition.onend = () => { if (isListening) recognition.start(); };
        els.micBtn.addEventListener('click', () => {
            if (!isListening) { recognition.start(); isListening = true; document.querySelector('.mic-pulse').classList.add('active'); showToast('Voice', 'Đang nghe...'); }
            else { recognition.stop(); isListening = false; document.querySelector('.mic-pulse').classList.remove('active'); showToast('Voice', 'Đã dừng.'); }
        });
    } else els.micBtn.style.display = 'none';

    els.ocrInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        els.ocrLoading.classList.remove('hidden');
        showToast('OCR', 'Đang quét hình ảnh...');
        try {
            const worker = Tesseract.createWorker({ logger: m => { if(m.status === 'recognizing text') document.getElementById('ocr-progress').style.width = `${Math.round(m.progress * 100)}%`; }});
            await worker.load(); await worker.loadLanguage('eng'); await worker.initialize('eng');
            const { data: { text } } = await worker.recognize(file);
            els.textInput.value += '\n' + text;
            await worker.terminate();
            showToast('OCR', 'Quét thành công!');
        } catch { showToast('Lỗi', 'Không thể đọc ảnh.', 'error'); } 
        finally { els.ocrLoading.classList.add('hidden'); e.target.value = ''; }
    });

    els.excelInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const json = XLSX.utils.sheet_to_json(XLSX.read(new Uint8Array(e.target.result), { type: 'array' }).Sheets[XLSX.read(new Uint8Array(e.target.result), { type: 'array' }).SheetNames[0]], { header: 1 });
            const newStudents = [];
            for (let i = 1; i < json.length; i++) if (json[i].length >= 3) newStudents.push({ id: Date.now() + Math.random(), name: toTitleCase(json[i][0] || ''), class: (json[i][1] || '').toString().toUpperCase(), violation: detectViolation(json[i][2] || ''), time: new Date() });
            
            if (newStudents.length > 0) { 
                appState.history.push([...appState.students]); 
                els.undoBtn.disabled = false; 
                appState.students = [...appState.students, ...newStudents]; 
                saveToLocal(); // Lưu sau khi nhập Excel
                renderReport(); 
                showToast('Excel', `Đã nhập ${newStudents.length} dòng.`); 
            }
        };
        reader.readAsArrayBuffer(file);
        els.excelInput.value = '';
    });

    const renderReport = () => {
        const container = els.reportContainer;
        if (appState.students.length === 0) {
            container.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-gray-500 opacity-60"><i class="fa-regular fa-clipboard text-6xl mb-4"></i><p>Chưa có dữ liệu vi phạm</p></div>`;
            document.getElementById('count-badge').classList.add('hidden');
            els.exportPngBtn.disabled = els.exportExcelBtn.disabled = true;
            return;
        }
        document.getElementById('count-badge').textContent = appState.students.length;
        document.getElementById('count-badge').classList.remove('hidden');
        els.exportPngBtn.disabled = els.exportExcelBtn.disabled = false;

        const groupedData = {};
        appState.students.forEach(s => { const v = s.violation || 'Lỗi khác'; if (!groupedData[v]) groupedData[v] = []; groupedData[v].push(s); });

        let html = '';
        let sttTotal = 1;
        for (const [vName, students] of Object.entries(groupedData)) {
            html += `<div class="mb-6"><div class="bg-gray-700/50 backdrop-blur-sm p-3 rounded-t-lg border-b border-gray-600 flex justify-between items-center sticky top-0 z-10"><h4 class="font-bold text-blue-400 uppercase text-sm flex items-center gap-2"><i class="fa-solid fa-circle-exclamation"></i>${vName}</h4><span class="bg-blue-900/50 text-blue-200 text-xs px-2 py-1 rounded-full font-mono">${students.length}</span></div><table class="w-full text-left border-collapse bg-gray-800/40 rounded-b-lg overflow-hidden"><thead class="bg-gray-800/60 text-xs uppercase text-gray-400"><tr><th class="p-3 w-12 text-center">STT</th><th class="p-3">Họ và Tên</th><th class="p-3 w-24 text-center">Lớp</th><th class="p-3 w-10"></th></tr></thead><tbody class="divide-y divide-gray-700/50">`;
            students.forEach(s => html += `<tr class="hover:bg-gray-700/30 transition-colors group"><td class="p-3 text-gray-500 font-mono text-sm text-center">${sttTotal++}</td><td class="p-3 font-medium text-gray-200">${s.name}</td><td class="p-3 text-center"><span class="bg-gray-700 text-yellow-400 px-2 py-1 rounded text-xs font-bold font-mono border border-gray-600">${s.class}</span></td><td class="p-3 text-center"><button onclick="deleteRow('${s.id}')" class="text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-700"><i class="fa-solid fa-xmark"></i></button></td></tr>`);
            html += `</tbody></table></div>`;
        }
        container.innerHTML = html;
    };

    window.deleteRow = id => { 
        appState.history.push([...appState.students]); 
        els.undoBtn.disabled = false; 
        appState.students = appState.students.filter(s => s.id != id); 
        saveToLocal(); // Lưu sau khi xoá
        renderReport(); 
    };

    els.undoBtn.addEventListener('click', () => { 
        if (appState.history.length > 0) { 
            appState.students = appState.history.pop(); 
            if (appState.history.length === 0) els.undoBtn.disabled = true; 
            saveToLocal(); // Lưu sau khi undo
            renderReport(); 
            showToast('Undo', 'Đã hoàn tác.'); 
        } 
    });

    els.clearBtn.addEventListener('click', () => { 
        if (confirm('Xóa TOÀN BỘ dữ liệu? Hành động này cũng sẽ xóa bản lưu tự động.')) { 
            appState.history.push([...appState.students]); 
            els.undoBtn.disabled = false; 
            appState.students = []; 
            
            // Xoá cả trong storage để reset hoàn toàn
            localStorage.removeItem(STORAGE_KEY); 
            
            renderReport(); 
            showToast('Đã xóa', 'Dữ liệu đã được làm sạch.');
        } 
    });

    els.exportPngBtn.addEventListener('click', () => {
        const exportDiv = document.createElement('div');
        Object.assign(exportDiv.style, { position: 'fixed', top: '0', left: '-9999px', zIndex: '9999', width: '650px', backgroundColor: '#ffffff', color: '#1a1a1a', fontFamily: "'Be Vietnam Pro', sans-serif", padding: '40px', boxSizing: 'border-box' });
        
        const groupedData = {};
        appState.students.forEach(s => { const v = s.violation || 'Lỗi khác'; if (!groupedData[v]) groupedData[v] = []; groupedData[v].push(s); });

        let groupsHtml = '', sttTotal = 1;
        for (const [vName, students] of Object.entries(groupedData)) {
            let studentsHtml = '';
            students.forEach(s => studentsHtml += `<tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 10px; color: #64748b; font-weight: 600; text-align: center; width: 50px;">${sttTotal++}</td><td style="padding: 10px;"><span style="font-weight: 700; color: #1e293b; text-transform: uppercase; font-size: 14px;">${s.name}</span></td><td style="padding: 10px; text-align: right;"><span style="background-color: #e2e8f0; color: #475569; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 13px;">${s.class}</span></td></tr>`);
            groupsHtml += `<div style="margin-bottom: 20px;"><div style="background-color: #eff6ff; border-left: 5px solid #2563eb; padding: 8px 15px; margin-bottom: 5px;"><h3 style="margin: 0; font-size: 15px; font-weight: 800; color: #1e40af; text-transform: uppercase;">${vName} <span style="font-weight: normal; font-size: 12px; color: #64748b; margin-left: 5px;">(${students.length} HS)</span></h3></div><table style="width: 100%; border-collapse: collapse; font-size: 14px;"><tbody>${studentsHtml}</tbody></table></div>`;
        }

        let metaHtml = '';
        if (els.opts.code.checked) metaHtml += `<div><span style="color: #64748b; font-weight: 600;">Mã:</span> <span style="font-weight: 700;">#${Math.floor(100000 + Math.random() * 900000)}</span></div>`;
        if (els.opts.date.checked || els.opts.time.checked) {
            let timeStr = '';
            if (els.opts.date.checked) timeStr += new Date().toLocaleDateString('vi-VN');
            if (els.opts.time.checked) timeStr += (timeStr ? ' - ' : '') + new Date().toLocaleTimeString('vi-VN');
            metaHtml += `<div style="text-align: right;"><span style="color: #64748b; font-weight: 600;">Thời gian:</span> <span style="font-weight: 700;">${timeStr}</span></div>`;
        }
        if (els.opts.monitor.checked) metaHtml += `<div><span style="color: #64748b; font-weight: 600;">Giám thị:</span> <span style="font-weight: 700; text-transform: uppercase;">${appState.monitorName}</span></div>`;
        if (els.opts.class.checked) metaHtml += `<div style="text-align: right;"><span style="color: #64748b; font-weight: 600;">Lớp trực:</span> <span style="font-weight: 700;">${appState.monitorClass}</span></div>`;

        exportDiv.innerHTML = `<div style="border: 2px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);"><div style="background-color: #0d0deb; color: white; padding: 25px 20px; text-align: center;"><div style="font-size: 32px; margin-bottom: 5px;">🏫</div><h2 style="margin: 0; font-size: 18px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9;">TRUNG TÂM GDTX - NN, TH TỈNH LÂM ĐỒNG</h2><h1 style="margin: 10px 0 0; font-size: 24px; font-weight: 800; text-transform: uppercase;">Phiếu Ghi Nhận Vi Phạm</h1></div><div style="padding: 20px; background-color: #f8fafc; border-bottom: 2px solid #e5e7eb; font-size: 13px;"><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">${metaHtml}</div></div><div style="padding: 20px;">${groupsHtml}</div><div style="background-color: #f8fafc; padding: 15px 20px; border-top: 2px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;"><span style="font-weight: 600; color: #475569; text-transform: uppercase; font-size: 13px;">Tổng số vi phạm</span><span style="font-size: 24px; font-weight: 800; color: #1e40af;">${appState.students.length}</span></div></div>`;
        document.body.appendChild(exportDiv);

        setTimeout(() => {
            html2canvas(exportDiv, { scale: 2, useCORS: true, backgroundColor: null, logging: false }).then(canvas => {
                const link = document.createElement('a');
                link.download = `Phieu_Bao_Cao_${Date.now()}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                document.body.removeChild(exportDiv); 
                showToast('Thành công', 'Đã xuất phiếu.');
            }).catch(() => { if (document.body.contains(exportDiv)) document.body.removeChild(exportDiv); showToast('Lỗi', 'Không thể xuất ảnh.', 'error'); });
        }, 500);
    });

    els.exportExcelBtn.addEventListener('click', () => {
        const wb = XLSX.utils.book_new();
        const wsData = [['TRUNG TÂM GDTX - NN, TH TỈNH LÂM ĐỒNG', '', '', ''], ['DANH SÁCH VI PHẠM', '', '', '']];
        
        if (els.opts.monitor.checked) wsData.push([`Giám thị: ${appState.monitorName}`, '', '', '']);
        if (els.opts.class.checked) wsData.push([`Lớp trực: ${appState.monitorClass}`, '', '', '']);
        
        let timeStr = '';
        if (els.opts.date.checked) timeStr += new Date().toLocaleDateString('vi-VN');
        if (els.opts.time.checked) timeStr += (timeStr ? ' - ' : '') + new Date().toLocaleTimeString('vi-VN');
        if (timeStr) wsData.push([`Thời gian: ${timeStr}`, '', '', '']);
        
        wsData.push(['', '', '', ''], ['STT', 'Họ và Tên', 'Lớp', 'Lỗi Vi Phạm']);
        appState.students.forEach((s, i) => wsData.push([i + 1, s.name, s.class, s.violation]));
        
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!cols'] = [{wch: 5}, {wch: 30}, {wch: 10}, {wch: 40}];
        XLSX.utils.book_append_sheet(wb, ws, "Vi Pham");
        XLSX.writeFile(wb, `DS_Vi_Pham_${Date.now()}.xlsx`);
        showToast('Thành công', 'Đã xuất Excel.');
    });

    // KHỞI ĐỘNG: KIỂM TRA DỮ LIỆU CŨ
    loadFromLocal();
});