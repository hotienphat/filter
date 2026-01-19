document.addEventListener('DOMContentLoaded', function() {
    // --- CONSTANTS & CONFIG ---
    const VIOLATIONS = {
        'KHONG_MANG_THE': 'Không mang thẻ học viên',
        'DI_HOC_MUON': 'Đi học muộn',
        'KHONG_MAC_AO_DOAN': 'Không mặc áo đoàn',
        'MANG_DEP_LE': 'Mang dép lê',
        'DI_XE_50CC': 'Đi xe trên 50cc',
        'NHUOM_TOC': 'Nhuộm tóc',
        'KHONG_SO_VIN': 'Không sơ vin'
    };

    // Mapping từ khóa tự nhiên sang mã lỗi (AI Logic)
    const VIOLATION_KEYWORDS = [
        { keys: ['khong mang the', 'quen the', 'khong the', 'ko the', 'k the', 'thieu the'], value: VIOLATIONS.KHONG_MANG_THE },
        { keys: ['di hoc muon', 'tre', 'muon', 'di muon', 'bi muon', 'muon hoc'], value: VIOLATIONS.DI_HOC_MUON },
        { keys: ['khong mac ao doan', 'ao doan', 'khong ao doan', 'ko ao doan', 'thieu ao doan'], value: VIOLATIONS.KHONG_MAC_AO_DOAN },
        { keys: ['mang dep', 'dep le', 'di dep'], value: VIOLATIONS.MANG_DEP_LE },
        { keys: ['xe tren 50', 'xe 50', 'xe phan khoi lon', 'xe may'], value: VIOLATIONS.DI_XE_50CC },
        { keys: ['nhuom toc', 'toc mau'], value: VIOLATIONS.NHUOM_TOC },
        { keys: ['so vin', 'khong so vin', 'bo ao'], value: VIOLATIONS.KHONG_SO_VIN }
    ];

    // --- DOM ELEMENTS ---
    const els = {
        loginScreen: document.getElementById('login-screen'),
        userNameInput: document.getElementById('user-name-input'),
        userClassInput: document.getElementById('user-class-input'),
        accessBtn: document.getElementById('access-btn'),
        mainContent: document.querySelector('main'),
        textInput: document.getElementById('text-input'),
        excelInput: document.getElementById('excel-input'),
        processBtn: document.getElementById('process-btn'),
        reportContainer: document.getElementById('report-container'),
        exportPngBtn: document.getElementById('export-png-btn'),
        exportExcelBtn: document.getElementById('export-excel-btn'),
        editBtn: document.getElementById('edit-btn'),
        saveBtn: document.getElementById('save-btn'),
        undoBtn: document.getElementById('undo-btn'),
        redoBtn: document.getElementById('redo-btn'),
        loadingSpinner: document.getElementById('loading-spinner'),
        alertModal: document.getElementById('alert-modal'),
        alertContent: document.getElementById('alert-modal-content'),
        alertTitle: document.getElementById('alert-title'),
        alertMessage: document.getElementById('alert-message'),
        alertCloseBtn: document.getElementById('alert-close-btn'),
        micBtn: document.getElementById('mic-btn'),
        clearTextBtn: document.getElementById('clear-text-btn'),
        clockDisplay: document.getElementById('clock-display')
    };

    // --- STATE ---
    let appState = {
        user: { name: '', className: '' },
        data: [],
        history: [],
        redoStack: [],
        isEditing: false
    };

    // --- CLOCK ---
    setInterval(() => {
        const now = new Date();
        if(els.clockDisplay) {
            els.clockDisplay.textContent = now.toLocaleTimeString('vi-VN') + ' - ' + now.toLocaleDateString('vi-VN');
        }
    }, 1000);

    // --- HELPER FUNCTIONS ---
    
    // Hàm viết hoa chữ cái đầu: "nguyễn văn a" -> "Nguyễn Văn A"
    function toTitleCase(str) {
        return str.toLowerCase().replace(/(^|\s)\S/g, (L) => L.toUpperCase());
    }

    // Hàm chuẩn hóa lớp: "10c1" -> "10C1"
    function normalizeClass(str) {
        return str.toUpperCase().replace(/\s/g, '');
    }

    // Hàm xóa dấu tiếng Việt
    function removeAccents(str) {
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
    }

    // AI Logic: Xác định lỗi từ văn bản nhập ẩu
    function detectViolation(text) {
        const normalized = removeAccents(text.toLowerCase().trim());
        for (const item of VIOLATION_KEYWORDS) {
            if (item.keys.some(key => normalized.includes(key))) {
                return item.value;
            }
        }
        return toTitleCase(text); // Nếu không tìm thấy, giữ nguyên nhưng viết hoa đẹp
    }

    function showAlert(title, message, isError = false) {
        els.alertTitle.textContent = title;
        els.alertMessage.textContent = message;
        document.getElementById('alert-icon').className = isError ? 'mb-4 text-4xl text-red-500' : 'mb-4 text-4xl text-yellow-500';
        document.getElementById('alert-icon').innerHTML = isError ? '<i class="fas fa-times-circle"></i>' : '<i class="fas fa-exclamation-triangle"></i>';
        
        els.alertModal.classList.remove('hidden');
        setTimeout(() => {
            els.alertContent.classList.remove('scale-95', 'opacity-0');
            els.alertContent.classList.add('scale-100', 'opacity-100');
        }, 10);
    }

    els.alertCloseBtn.addEventListener('click', () => {
        els.alertContent.classList.remove('scale-100', 'opacity-100');
        els.alertContent.classList.add('scale-95', 'opacity-0');
        setTimeout(() => els.alertModal.classList.add('hidden'), 300);
    });

    // --- CORE LOGIC: SMART PARSER ---
    // Đây là phần "AI" giúp xử lý nhập liệu lộn xộn
    function smartParseText(text) {
        // Regex tìm lớp: Bắt đầu bằng 10, 11, 12, theo sau là chữ cái và số (VD: 10A1, 11C2, 12D)
        const classRegex = /\b(1[0-2][a-zA-Z]{1,2}\d{0,2})\b/i;
        
        return text.split('\n')
            .map(line => line.trim())
            .filter(line => line)
            .map(line => {
                let name = '';
                let className = '';
                let rawViolation = '';

                // 1. Tách lớp học ra trước (vì nó có định dạng rõ ràng nhất)
                const classMatch = line.match(classRegex);
                if (classMatch) {
                    className = normalizeClass(classMatch[0]);
                    // Loại bỏ lớp khỏi chuỗi để xử lý phần còn lại
                    line = line.replace(classMatch[0], ' |split| ');
                }

                // 2. Nếu người dùng dùng dấu gạch ngang phân cách rõ ràng
                if (line.includes('-') && !line.includes('|split|')) {
                    const parts = line.split('-').map(p => p.trim());
                    if (parts.length >= 2) {
                        name = toTitleCase(parts[0]);
                        if (!className && parts[1].match(/^[0-9]/)) className = normalizeClass(parts[1]);
                        rawViolation = parts[parts.length - 1];
                    }
                } else {
                    // 3. Xử lý chuỗi hỗn độn "nguyen van a |split| di muon"
                    const parts = line.split('|split|').map(p => p.trim());
                    
                    // Strategy mới (FIXED): Tách từ phải sang trái để tìm lỗi
                    let fullText = parts.join(' ').replace(/\s+/g, ' ').trim(); 
                    let words = fullText.split(' ');
                    
                    let foundViolationCode = null;
                    let violationTextLength = 0; // Số lượng từ thuộc về phần lỗi

                    // Thử ghép từ 1 đến 5 từ cuối cùng để xem có phải lỗi không
                    for (let i = 1; i <= 5 && i <= words.length; i++) {
                        const suffixWords = words.slice(words.length - i);
                        const suffixText = suffixWords.join(' ');
                        const normalizedSuffix = removeAccents(suffixText.toLowerCase());

                        // Check xem suffix này có match keyword nào không
                        for (const item of VIOLATION_KEYWORDS) {
                            if (item.keys.includes(normalizedSuffix)) {
                                foundViolationCode = item.value;
                                violationTextLength = i;
                                break;
                            }
                        }
                        if (foundViolationCode) break;
                    }

                    if (foundViolationCode) {
                        rawViolation = foundViolationCode;
                        // Tên là phần còn lại sau khi bỏ các từ lỗi
                        const nameWords = words.slice(0, words.length - violationTextLength);
                        name = toTitleCase(nameWords.join(' '));
                    } else {
                        // Nếu không tìm thấy lỗi theo keyword (scan ngược thất bại)
                        // Fallback: 
                        if (parts.length > 1) {
                             // Nếu có dấu split (do tách lớp), phần đầu là tên, phần sau là rác hoặc lỗi lạ
                             name = toTitleCase(parts[0]);
                             rawViolation = toTitleCase(parts[1]); 
                        } else {
                            // Fallback cuối cùng: Coi toàn bộ là tên, lỗi chưa rõ
                            name = toTitleCase(fullText);
                            rawViolation = 'Chưa rõ lỗi';
                        }
                    }
                }

                if (name && className) {
                    // Detect lại lần nữa để chắc chắn (dành cho trường hợp fallback)
                    const finalViolation = Object.values(VIOLATIONS).includes(rawViolation) 
                        ? rawViolation 
                        : detectViolation(rawViolation || 'Chưa rõ lỗi');

                    return {
                        id: crypto.randomUUID(),
                        name: name,
                        className: className,
                        violation: finalViolation,
                        timestamp: new Date()
                    };
                }
                return null;
            })
            .filter(Boolean);
    }

    // --- EVENT HANDLERS ---

    // 1. Login
    const checkLogin = () => {
        els.accessBtn.disabled = !(els.userNameInput.value.trim() && els.userClassInput.value.trim());
    };
    els.userNameInput.addEventListener('input', checkLogin);
    els.userClassInput.addEventListener('input', checkLogin);
    
    els.accessBtn.addEventListener('click', () => {
        appState.user.name = toTitleCase(els.userNameInput.value.trim());
        appState.user.className = els.userClassInput.value.trim().toUpperCase();
        els.loginScreen.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => {
            els.loginScreen.classList.add('hidden');
            els.mainContent.classList.remove('hidden');
            els.mainContent.classList.add('flex');
        }, 500);
    });

    // 2. Voice Input (Speech to Text)
    if ('webkitSpeechRecognition' in window) {
        const recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'vi-VN';

        els.micBtn.addEventListener('click', () => {
            if (els.micBtn.classList.contains('mic-active')) {
                recognition.stop();
            } else {
                recognition.start();
                els.micBtn.classList.add('mic-active');
                els.micBtn.innerHTML = '<i class="fas fa-stop"></i> <span>Dừng</span>';
            }
        });

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            const currentText = els.textInput.value;
            els.textInput.value = currentText + (currentText ? '\n' : '') + transcript;
            els.micBtn.classList.remove('mic-active');
            els.micBtn.innerHTML = '<i class="fas fa-microphone"></i> <span>Nói</span>';
        };

        recognition.onerror = () => {
            els.micBtn.classList.remove('mic-active');
            els.micBtn.innerHTML = '<i class="fas fa-microphone"></i> <span>Nói</span>';
            showAlert('Lỗi Micro', 'Không thể nhận diện giọng nói. Vui lòng kiểm tra micro.', true);
        };
        
        recognition.onend = () => {
            els.micBtn.classList.remove('mic-active');
            els.micBtn.innerHTML = '<i class="fas fa-microphone"></i> <span>Nói</span>';
        };
    } else {
        els.micBtn.style.display = 'none'; // Ẩn nếu trình duyệt không hỗ trợ
    }

    els.clearTextBtn.addEventListener('click', () => els.textInput.value = '');

    // 3. Process Data
    els.processBtn.addEventListener('click', async () => {
        els.loadingSpinner.classList.remove('hidden');
        els.processBtn.disabled = true;

        // Simulate processing delay for "AI feel"
        setTimeout(async () => {
            let newStudents = [];
            const textValue = els.textInput.value.trim();
            const excelFile = els.excelInput.files[0];

            try {
                if (textValue) {
                    newStudents = smartParseText(textValue);
                } else if (excelFile) {
                    newStudents = await parseExcelInput(excelFile);
                } else {
                    showAlert('Chưa nhập liệu', 'Vui lòng nhập văn bản hoặc chọn file Excel.');
                    els.loadingSpinner.classList.add('hidden');
                    els.processBtn.disabled = false;
                    return;
                }

                if (newStudents.length > 0) {
                    appState.history.push([...appState.data]); // Save state for Undo
                    appState.redoStack = []; // Clear redo
                    appState.data = [...appState.data, ...newStudents];
                    renderReport();
                    els.textInput.value = ''; // Clear input
                    els.excelInput.value = '';
                } else {
                    showAlert('Không tìm thấy dữ liệu', 'Vui lòng kiểm tra lại định dạng nhập.');
                }
            } catch (e) {
                console.error(e);
                showAlert('Lỗi', 'Có lỗi xảy ra khi xử lý dữ liệu.', true);
            } finally {
                els.loadingSpinner.classList.add('hidden');
                els.processBtn.disabled = false;
                updateUndoRedoUI();
            }
        }, 600);
    });

    // 4. Excel Parsing
    function parseExcelInput(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                    // Simple mapping logic
                    // Assume Row 1 is header
                    if (json.length < 2) return resolve([]);
                    // Detect columns by header keywords
                    const headers = json[0].map(h => removeAccents(String(h).toLowerCase()));
                    const nameIdx = headers.findIndex(h => h.includes('ten'));
                    const classIdx = headers.findIndex(h => h.includes('lop'));
                    const violIdx = headers.findIndex(h => h.includes('loi') || h.includes('vi pham'));

                    if (nameIdx === -1 || classIdx === -1) return reject('Không tìm thấy cột Tên hoặc Lớp');

                    const results = json.slice(1).map(row => {
                        if (!row[nameIdx]) return null;
                        return {
                            id: crypto.randomUUID(),
                            name: toTitleCase(row[nameIdx]),
                            className: normalizeClass(row[classIdx] ? String(row[classIdx]) : ''),
                            violation: detectViolation(row[violIdx] ? String(row[violIdx]) : 'Chưa rõ lỗi'),
                            timestamp: new Date()
                        };
                    }).filter(Boolean);
                    resolve(results);
                } catch (err) { reject(err); }
            };
            reader.readAsArrayBuffer(file);
        });
    }

    // 5. Render Report
    function renderReport() {
        const container = els.reportContainer;
        if (appState.data.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-gray-500 mt-20">
                    <i class="fas fa-clipboard-list text-6xl mb-4 opacity-20"></i>
                    <p>Chưa có dữ liệu vi phạm.</p>
                </div>`;
            return;
        }

        // Group by Violation
        const grouped = appState.data.reduce((acc, curr) => {
            const v = curr.violation;
            if (!acc[v]) acc[v] = [];
            acc[v].push(curr);
            return acc;
        }, {});

        let html = `
            <div id="report-printable" class="bg-white text-black p-6 rounded-lg shadow-sm">
                <div class="border-b-2 border-blue-800 pb-4 mb-4 flex justify-between items-start">
                    <div>
                        <h2 class="text-2xl font-bold text-blue-900 uppercase">Báo Cáo Vi Phạm</h2>
                        <p class="text-sm text-gray-600">Ngày: ${new Date().toLocaleDateString('vi-VN')}</p>
                        <p class="text-xs text-gray-500 italic mt-1 font-bold">Thời gian xuất báo cáo: ${new Date().toLocaleTimeString('vi-VN')}</p>
                    </div>
                    <div class="text-right text-sm">
                        <p><strong>Giám thị:</strong> ${appState.user.name}</p>
                        <p><strong>Đơn vị:</strong> ${appState.user.className}</p>
                    </div>
                </div>
        `;

        Object.keys(grouped).sort().forEach(violation => {
            const list = grouped[violation];
            html += `
                <div class="mb-6">
                    <h3 class="text-lg font-bold text-gray-800 border-l-4 border-blue-600 pl-2 mb-2 bg-gray-100 p-1">
                        ${violation} <span class="text-sm font-normal text-gray-500">(${list.length} học sinh)</span>
                    </h3>
                    <table class="w-full text-sm border-collapse">
                        <thead>
                            <tr class="bg-gray-50 text-gray-600">
                                <th class="border p-2 text-left w-10">STT</th>
                                <th class="border p-2 text-left">Họ và Tên</th>
                                <th class="border p-2 text-center w-20">Lớp</th>
                                <th class="border p-2 text-center w-24">Thời gian</th>
                                ${appState.isEditing ? '<th class="border p-2 text-center w-16">Xóa</th>' : ''}
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            list.forEach((st, idx) => {
                html += `
                    <tr data-id="${st.id}" class="hover:bg-gray-50">
                        <td class="border p-2 text-center">${idx + 1}</td>
                        <td class="border p-2 font-medium" ${appState.isEditing ? 'contenteditable="true" data-field="name"' : ''}>${st.name}</td>
                        <td class="border p-2 text-center" ${appState.isEditing ? 'contenteditable="true" data-field="className"' : ''}>${st.className}</td>
                        <td class="border p-2 text-center text-gray-500 text-xs">${new Date(st.timestamp).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}</td>
                        ${appState.isEditing ? `<td class="border p-2 text-center"><button class="text-red-500 hover:text-red-700 delete-btn"><i class="fas fa-trash"></i></button></td>` : ''}
                    </tr>
                `;
            });

            html += `</tbody></table></div>`;
        });

        html += `
            <div class="mt-8 pt-4 border-t text-center text-xs text-gray-400">
                Báo cáo được tạo tự động bởi hệ thống Trợ Lý Giám Thị AI
            </div>
        </div>`; // Close report-printable

        container.innerHTML = html;

        // Add Delete Event Listeners if editing
        if (appState.isEditing) {
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const row = e.target.closest('tr');
                    const id = row.dataset.id;
                    row.remove();
                    // Note: actual data update happens on Save
                });
            });
        }
    }

    // 6. Undo / Redo
    function updateUndoRedoUI() {
        els.undoBtn.disabled = appState.history.length === 0;
        els.redoBtn.disabled = appState.redoStack.length === 0;
    }

    els.undoBtn.addEventListener('click', () => {
        if (appState.history.length > 0) {
            appState.redoStack.push([...appState.data]);
            appState.data = appState.history.pop();
            renderReport();
            updateUndoRedoUI();
        }
    });

    els.redoBtn.addEventListener('click', () => {
        if (appState.redoStack.length > 0) {
            appState.history.push([...appState.data]);
            appState.data = appState.redoStack.pop();
            renderReport();
            updateUndoRedoUI();
        }
    });

    // 7. Edit / Save
    els.editBtn.addEventListener('click', () => {
        appState.isEditing = true;
        els.editBtn.classList.add('hidden');
        els.saveBtn.classList.remove('hidden');
        renderReport();
    });

    els.saveBtn.addEventListener('click', () => {
        appState.history.push([...appState.data]); // Save before modify
        appState.redoStack = [];

        // Re-scan DOM to update data
        const newDataSet = [];
        const rows = document.querySelectorAll('#report-printable tbody tr');
        rows.forEach(row => {
            const id = row.dataset.id;
            const oldRecord = appState.data.find(d => d.id === id);
            if (oldRecord) {
                const nameEl = row.querySelector('[data-field="name"]');
                const classEl = row.querySelector('[data-field="className"]');
                if (nameEl && classEl) {
                    oldRecord.name = toTitleCase(nameEl.textContent.trim());
                    oldRecord.className = normalizeClass(classEl.textContent.trim());
                    newDataSet.push(oldRecord);
                }
            }
        });
        
        appState.data = newDataSet;
        appState.isEditing = false;
        els.saveBtn.classList.add('hidden');
        els.editBtn.classList.remove('hidden');
        renderReport();
        updateUndoRedoUI();
    });

    // 8. Export PNG
    els.exportPngBtn.addEventListener('click', () => {
        const element = document.getElementById('report-printable');
        if (!element) return showAlert('Lỗi', 'Chưa có báo cáo để xuất.', true);

        // Clone to style specifically for export
        const clone = element.cloneNode(true);
        clone.classList.add('export-style');
        document.body.appendChild(clone);
        clone.style.position = 'absolute';
        clone.style.left = '-9999px';

        html2canvas(clone, { scale: 2, useCORS: true }).then(canvas => {
            const link = document.createElement('a');
            link.download = `BaoCao_ViPham_${new Date().toISOString().slice(0,10)}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            document.body.removeChild(clone);
        });
    });

    // 9. Export Excel
    els.exportExcelBtn.addEventListener('click', () => {
        if (appState.data.length === 0) return showAlert('Lỗi', 'Chưa có dữ liệu.', true);

        const wb = XLSX.utils.book_new();
        
        // Format Data for Excel
        const wsData = [
            ['BÁO CÁO TỔNG HỢP VI PHẠM HỌC SINH'],
            [`Ngày: ${new Date().toLocaleDateString('vi-VN')}`],
            [`Thời gian xuất: ${new Date().toLocaleTimeString('vi-VN')}`],
            [`Giám thị: ${appState.user.name} - ${appState.user.className}`],
            [],
            ['STT', 'Họ và Tên', 'Lớp', 'Lỗi Vi Phạm', 'Thời gian ghi nhận']
        ];

        appState.data.forEach((st, idx) => {
            wsData.push([
                idx + 1,
                st.name,
                st.className,
                st.violation,
                new Date(st.timestamp).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        
        // Column widths
        ws['!cols'] = [{wch: 5}, {wch: 25}, {wch: 10}, {wch: 30}, {wch: 15}];
        
        // Merge title
        ws['!merges'] = [
            { s: {r:0, c:0}, e: {r:0, c:4} }
        ];

        XLSX.utils.book_append_sheet(wb, ws, "ViPham");
        XLSX.writeFile(wb, `BaoCao_ViPham_${new Date().toISOString().slice(0,10)}.xlsx`);
    });

});