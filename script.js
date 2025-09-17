document.addEventListener('DOMContentLoaded', function() {
    // Định nghĩa các lỗi vi phạm được nhận dạng
    const VIOLATIONS = {
        'KHONG_MANG_THE': 'Không mang thẻ học viên',
        'DI_HOC_MUON': 'Đi học muộn',
        'KHONG_MAC_AO_DOAN': 'Không mặc áo đoàn',
        'MANG_DEP_LE': 'Mang dép lê',
        'DI_XE_50CC': 'Đi xe trên 50cc'
    };

    // --- Lấy các element từ DOM ---
    const loginScreen = document.getElementById('login-screen');
    const userNameInput = document.getElementById('user-name-input');
    const userClassInput = document.getElementById('user-class-input');
    const accessBtn = document.getElementById('access-btn');
    const mainContent = document.querySelector('main');
    const textInput = document.getElementById('text-input');
    const excelInput = document.getElementById('excel-input');
    const processBtn = document.getElementById('process-btn');
    const reportContainer = document.getElementById('report-container');
    const reportActions = document.getElementById('report-actions');
    const viewModeButtons = document.getElementById('view-mode-buttons');
    const editModeButtons = document.getElementById('edit-mode-buttons');
    const exportPngBtn = document.getElementById('export-png-btn');
    const exportExcelBtn = document.getElementById('export-excel-btn');
    const editBtn = document.getElementById('edit-btn');
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    const saveBtn = document.getElementById('save-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const loadingSpinner = document.getElementById('loading-spinner');
    const alertModal = document.getElementById('alert-modal');
    const alertModalContent = document.getElementById('alert-modal-content');
    const alertTitle = document.getElementById('alert-title');
    const alertMessage = document.getElementById('alert-message');
    const alertCloseBtn = document.getElementById('alert-close-btn');

    // --- Biến trạng thái ---
    let userInfo = { name: '', className: '' };
    let processedData = []; // Lưu trữ dữ liệu đã được xử lý
    let historyStack = []; // Lưu trữ lịch sử các lần nhập (undo)
    let redoStack = []; // Lưu trữ lịch sử để làm lại (redo)

    // --- Xử lý màn hình đăng nhập ---
    function checkLoginInputs() {
        const name = userNameInput.value.trim();
        const className = userClassInput.value.trim();
        accessBtn.disabled = !(name && className);
    }

    [userNameInput, userClassInput].forEach(input => {
        input.addEventListener('input', checkLoginInputs);
    });
    
    accessBtn.addEventListener('click', () => {
        userInfo.name = userNameInput.value.trim();
        userInfo.className = userClassInput.value.trim();
        loginScreen.classList.add('hidden');
        mainContent.classList.remove('hidden');
    });

    // --- Hàm tiện ích ---
    function toggleModal(show, title, message) {
        if (show) {
            alertTitle.textContent = title;
            alertMessage.textContent = message;
            alertModal.classList.remove('hidden');
            setTimeout(() => alertModalContent.classList.add('scale-100', 'opacity-100'), 10);
        } else {
            alertModalContent.classList.remove('scale-100', 'opacity-100');
            setTimeout(() => alertModal.classList.add('hidden'), 300);
        }
    }
    
    alertCloseBtn.addEventListener('click', () => toggleModal(false));

    function updateUndoRedoButtons() {
        undoBtn.disabled = historyStack.length === 0;
        redoBtn.disabled = redoStack.length === 0;
    }

    function removeAccents(str) {
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
    }

    function normalizeViolation(text) {
        const normalized = removeAccents(text.toLowerCase().trim());
        if (normalized.includes('khong mang the') || normalized.includes('quen the')) return VIOLATIONS.KHONG_MANG_THE;
        if (normalized.includes('di hoc muon') || normalized.includes('tre')) return VIOLATIONS.DI_HOC_MUON;
        if (normalized.includes('khong mac ao doan') || normalized.includes('ao doan')) return VIOLATIONS.KHONG_MAC_AO_DOAN;
        if (normalized.includes('mang dep') || normalized.includes('dep le')) return VIOLATIONS.MANG_DEP_LE;
        if (normalized.includes('tren 50cc')) return VIOLATIONS.DI_XE_50CC;
        if (['the', 'khong the'].includes(normalized)) return VIOLATIONS.KHONG_MANG_THE;
        if (['muon', 'di muon'].includes(normalized)) return VIOLATIONS.DI_HOC_MUON;
        if (['ao', 'ao doan'].includes(normalized)) return VIOLATIONS.KHONG_MAC_AO_DOAN;
        if (['dep', 'dep le'].includes(normalized)) return VIOLATIONS.MANG_DEP_LE;
        if (['xe', 'xe 50'].includes(normalized)) return VIOLATIONS.DI_XE_50CC;
        return text;
    }
    
    function toggleEditMode(isEditing) {
        viewModeButtons.classList.toggle('hidden', isEditing);
        editModeButtons.classList.toggle('hidden', !isEditing);
        processBtn.disabled = isEditing;
        displayReport(processedData, isEditing);
    }
    
    // --- Xử lý sự kiện chính ---
    processBtn.addEventListener('click', async () => {
        loadingSpinner.classList.remove('hidden');
        processBtn.disabled = true;
        
        let newStudents = [];
        const textValue = textInput.value.trim();
        const excelFile = excelInput.files[0];

        try {
            if (textValue) {
                newStudents = parseTextInput(textValue);
            } else if (excelFile) {
                newStudents = await parseExcelInput(excelFile);
            } else {
                toggleModal(true, 'Chưa có dữ liệu', 'Vui lòng nhập dữ liệu từ văn bản hoặc tải lên một tệp Excel.');
                return;
            }

            if (newStudents.length === 0) {
                toggleModal(true, 'Dữ liệu không hợp lệ', 'Không tìm thấy dữ liệu vi phạm hợp lệ. Vui lòng kiểm tra lại định dạng đầu vào.');
                return;
            }
            
            historyStack.push([...processedData]);
            redoStack = []; // Xóa lịch sử redo khi có hành động mới
            processedData = processedData.concat(newStudents);
            displayReport(processedData);
            
            textInput.value = '';
            excelInput.value = '';

        } catch (error) {
            console.error('Error processing data:', error);
            toggleModal(true, 'Lỗi xử lý', 'Đã có lỗi xảy ra. Vui lòng kiểm tra lại định dạng tệp hoặc nội dung nhập.');
        } finally {
            loadingSpinner.classList.add('hidden');
            processBtn.disabled = false;
            updateUndoRedoButtons();
        }
    });
    
    undoBtn.addEventListener('click', () => {
        if (historyStack.length > 0) {
            redoStack.push([...processedData]); // Lưu trạng thái hiện tại vào redo
            processedData = historyStack.pop();
            displayReport(processedData);
            updateUndoRedoButtons();
        }
    });

    redoBtn.addEventListener('click', () => {
        if (redoStack.length > 0) {
            historyStack.push([...processedData]); // Lưu trạng thái hiện tại vào undo
            processedData = redoStack.pop();
            displayReport(processedData);
            updateUndoRedoButtons();
        }
    });

    editBtn.addEventListener('click', () => toggleEditMode(true));
    cancelBtn.addEventListener('click', () => toggleEditMode(false));

    saveBtn.addEventListener('click', () => {
        historyStack.push([...processedData]);
        redoStack = []; // Xóa lịch sử redo khi có hành động mới
        const newData = [];
        const rows = reportContainer.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const id = row.dataset.studentId;
            const timestamp = new Date(row.dataset.timestamp);
            const name = row.querySelector('[data-field="name"]').textContent.trim();
            const className = row.querySelector('[data-field="class"]').textContent.trim();
            const violation = row.querySelector('[data-field="violation"] select').value;
            
            if (name && className && violation) {
                newData.push({ id, 'Họ và tên': name, 'Lớp': className, 'Lỗi vi phạm': violation, timestamp });
            }
        });
        processedData = newData;
        toggleEditMode(false);
        updateUndoRedoButtons();
    });

    reportContainer.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('delete-row-btn')) {
            e.target.closest('tr').remove();
        }
    });

    window.addEventListener('beforeunload', function (e) {
        if (processedData.length > 0) {
            const confirmationMessage = 'Bạn có chắc chắn muốn rời khỏi trang? Dữ liệu chưa lưu sẽ bị mất.';
            (e || window.event).returnValue = confirmationMessage; // For IE and Firefox
            return confirmationMessage; // For Safari
        }
    });

    // --- Hàm phân tích dữ liệu ---
    function parseTextInput(text) {
        const classRegex = /\b(\d{1,2}[a-zA-Z][\d]{0,2})\b/; 
        return text.split('\n').map(line => line.trim()).filter(line => line)
            .map(line => {
                let student = null;
                const parts = line.split('-').map(part => part.trim());
                if (parts.length >= 3) {
                     student = { 'Họ và tên': parts[0], 'Lớp': parts[1], 'Lỗi vi phạm': normalizeViolation(parts.slice(2).join('-').trim()) };
                } else {
                    const match = line.match(classRegex);
                    if (match) {
                        const className = match[0];
                        const name = line.substring(0, match.index).trim();
                        const violationText = line.substring(match.index + className.length).trim();
                        if (name && className && violationText) {
                            student = { 'Họ và tên': name, 'Lớp': className, 'Lỗi vi phạm': normalizeViolation(violationText) };
                        }
                    }
                }
                if (student) {
                    student.id = crypto.randomUUID();
                    student.timestamp = new Date();
                }
                return student;
            }).filter(Boolean);
    }

    function parseExcelInput(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = new Uint8Array(event.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    if (json.length < 2) { resolve([]); return; }

                    const headers = json[0].map(h => removeAccents(h.toString().toLowerCase().trim()));
                    const nameIndex = headers.indexOf('ho va ten');
                    const classIndex = headers.indexOf('lop');
                    const violationIndex = headers.indexOf('loi vi pham');
                    
                    if (nameIndex === -1 || classIndex === -1 || violationIndex === -1) {
                        reject(new Error('Tệp Excel thiếu các cột bắt buộc: Họ và tên, Lớp, Lỗi vi phạm.'));
                        return;
                    }
                    const students = json.slice(1).map(row => ({
                        id: crypto.randomUUID(), 
                        'Họ và tên': row[nameIndex], 
                        'Lớp': row[classIndex],
                        'Lỗi vi phạm': normalizeViolation(row[violationIndex] ? row[violationIndex].toString() : ''),
                        timestamp: new Date()
                    })).filter(s => s['Họ và tên'] && s['Lớp'] && s['Lỗi vi phạm']);
                    resolve(students);
                } catch (e) { reject(e); }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    // --- Hiển thị và xuất báo cáo ---
    function displayReport(data, isEditing = false) {
        // If there is no data and no history to redo, hide the action panel.
        if (data.length === 0 && redoStack.length === 0) {
            reportContainer.innerHTML = `<p class="text-gray-400 text-center py-20">Chưa có dữ liệu.</p>`;
            reportActions.classList.add('hidden');
            return;
        }

        reportActions.classList.remove('hidden');
        
        if (data.length === 0) {
            // Data is empty, but we can redo, so just show the placeholder.
            reportContainer.innerHTML = `<p class="text-gray-400 text-center py-20">Chưa có dữ liệu.</p>`;
        } else {
            const groupedByViolation = data.reduce((acc, student) => {
                const violation = student['Lỗi vi phạm'];
                if (!acc[violation]) acc[violation] = [];
                acc[violation].push(student);
                return acc;
            }, {});

            let reportHTML = `<div class="report-content bg-white text-black p-6 rounded-lg">
                            <div class="report-header text-center pb-4 mb-4 border-b">
                                <h2 class="text-2xl font-bold text-gray-800">BÁO CÁO TỔNG HỢP VI PHẠM</h2>
                                <p class="text-gray-600">Ngày ${new Date().toLocaleDateString('vi-VN')}</p>
                                <div class="text-sm text-gray-500 mt-2">
                                    <span><b>Người tạo:</b> ${userInfo.name}</span> | <span><b>Chức vụ:</b> ${userInfo.className}</span>
                                </div>
                            </div>
                            <div class="text-base">`;

            const sortedViolations = Object.keys(groupedByViolation).sort();
            for (const violation of sortedViolations) {
                const students = groupedByViolation[violation];
                reportHTML += `<div class="mb-6">
                                <h3 class="text-lg font-bold text-gray-700 border-b pb-2 mb-3">
                                    ${violation.toUpperCase()} - (Tổng số: ${students.length})
                                </h3>
                                <table class="min-w-full border-collapse">
                                    <thead class="bg-gray-50">
                                        <tr>
                                            <th class="p-2 text-left border w-[35%] whitespace-nowrap">Họ và tên</th>
                                            <th class="p-2 text-left border w-[15%] whitespace-nowrap">Lớp</th>
                                            <th class="p-2 text-left border w-[15%] whitespace-nowrap">Thời gian</th>
                                            <th class="p-2 text-left border w-[${isEditing ? '25%' : '35%'}] whitespace-nowrap">Lỗi vi phạm</th>
                                            ${isEditing ? '<th class="p-2 text-center border w-[10%]">Xóa</th>' : ''}
                                        </tr>
                                    </thead>
                                    <tbody>`;
                students.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)).forEach((student) => {
                    let violationCellHTML = student['Lỗi vi phạm'];
                    if (isEditing) {
                        const options = Object.values(VIOLATIONS)
                            .map(v => `<option value="${v}" ${v === student['Lỗi vi phạm'] ? 'selected' : ''}>${v}</option>`)
                            .join('');
                        violationCellHTML = `<select class="w-full border border-gray-300 p-1 rounded">${options}</select>`;
                    }

                    reportHTML += `<tr data-student-id="${student.id}" data-timestamp="${student.timestamp.toISOString()}">
                            <td class="p-2 border" data-field="name" ${isEditing ? 'contenteditable="true"' : ''}>${student['Họ và tên']}</td>
                            <td class="p-2 border" data-field="class" ${isEditing ? 'contenteditable="true"' : ''}>${student['Lớp']}</td>
                            <td class="p-2 border">${new Date(student.timestamp).toLocaleTimeString('vi-VN')}</td>
                            <td class="p-2 border" data-field="violation">${violationCellHTML}</td>
                            ${isEditing ? `<td class="p-2 border text-center"><button class="delete-row-btn bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 text-xs">Xóa</button></td>` : ''}
                        </tr>`;
                });
                reportHTML += `</tbody></table></div>`;
            }
            reportHTML += '</div></div>';
            reportContainer.innerHTML = reportHTML;
        }
    }
    
    exportPngBtn.addEventListener('click', () => {
        const reportElement = reportContainer.querySelector('.report-content');
        if (reportElement) {
            const clonedReport = reportElement.cloneNode(true);
            clonedReport.style.position = 'absolute';
            clonedReport.style.left = '-9999px';
            clonedReport.style.top = '0';
            clonedReport.style.width = '800px'; 
            document.body.appendChild(clonedReport);

            html2canvas(clonedReport, { 
                scale: 2,
                backgroundColor: '#ffffff',
                windowWidth: clonedReport.scrollWidth,
                windowHeight: clonedReport.scrollHeight
            }).then(canvas => {
                const link = document.createElement('a');
                link.download = `bao-cao-vi-pham-${new Date().toISOString().slice(0,10)}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            }).catch(err => {
                console.error('Lỗi khi xuất PNG:', err);
                toggleModal(true, 'Lỗi xuất ảnh', 'Không thể tạo tệp ảnh. Vui lòng thử lại.');
            }).finally(() => {
                document.body.removeChild(clonedReport);
            });
        }
    });

    exportExcelBtn.addEventListener('click', () => {
        if (processedData.length > 0) {
            try {
                const header = [
                    ["BÁO CÁO TỔNG HỢP VI PHẠM"],
                    [`Ngày tạo: ${new Date().toLocaleDateString('vi-VN')}`],
                    [`Người tạo: ${userInfo.name} (${userInfo.className})`],
                    [], 
                    ['Họ và tên', 'Lớp', 'Lỗi vi phạm', 'Thời gian']
                ];

                const dataToExport = processedData.map(item => [
                    item['Họ và tên'],
                    item['Lớp'],
                    item['Lỗi vi phạm'],
                    new Date(item.timestamp).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
                ]);
                
                const worksheet = XLSX.utils.aoa_to_sheet(header.concat(dataToExport));
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, 'ViPhamHocSinh');
                
                worksheet['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 30 }, { wch: 15 }];
                worksheet['!merges'] = [
                    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
                    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
                    { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } }
                ];

                XLSX.writeFile(workbook, `tong-hop-vi-pham-${new Date().toISOString().slice(0,10)}.xlsx`);
            } catch (err) {
                console.error('Lỗi khi xuất Excel:', err);
                toggleModal(true, 'Lỗi xuất Excel', 'Không thể tạo tệp Excel. Vui lòng thử lại.');
            }
        }
    });
    
    // Khởi tạo trạng thái ban đầu của nút
    updateUndoRedoButtons();
});