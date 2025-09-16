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

    // Login screen elements
    const loginScreen = document.getElementById('login-screen');
    const userNameInput = document.getElementById('user-name-input');
    const userClassInput = document.getElementById('user-class-input');
    const accessBtn = document.getElementById('access-btn');
    const mainContent = document.querySelector('main');

    // Main app elements
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
    const clearBtn = document.getElementById('clear-btn');
    const saveBtn = document.getElementById('save-btn');
    const cancelBtn = document.getElementById('cancel-btn');

    const loadingSpinner = document.getElementById('loading-spinner');
    
    // Modal elements
    const alertModal = document.getElementById('alert-modal');
    const alertModalContent = document.getElementById('alert-modal-content');
    const alertTitle = document.getElementById('alert-title');
    const alertMessage = document.getElementById('alert-message');
    const alertCloseBtn = document.getElementById('alert-close-btn');
    const alertConfirmBtn = document.getElementById('alert-confirm-btn');

    // --- Biến trạng thái ---
    let userInfo = { name: '', className: '' };
    let processedData = []; // Lưu trữ dữ liệu đã được xử lý
    let historyStack = []; // Lưu trữ lịch sử các lần nhập
    let confirmCallback = null;

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
    
    // Hàm hiển thị/đóng modal với animation
    function toggleModal(show, title, message, isConfirmation = false, onConfirm = null) {
        if (show) {
            alertTitle.textContent = title;
            alertMessage.textContent = message;
            confirmCallback = onConfirm;
            if (isConfirmation) {
                alertConfirmBtn.classList.remove('hidden');
                alertCloseBtn.textContent = 'Hủy';
            } else {
                alertConfirmBtn.classList.add('hidden');
                alertCloseBtn.textContent = 'Đã hiểu';
            }
            alertModal.classList.remove('hidden');
            setTimeout(() => alertModalContent.classList.add('scale-100', 'opacity-100'), 10);
        } else {
            alertModalContent.classList.remove('scale-100', 'opacity-100');
            setTimeout(() => alertModal.classList.add('hidden'), 300);
        }
    }
    
    alertCloseBtn.addEventListener('click', () => toggleModal(false));
    alertConfirmBtn.addEventListener('click', () => {
        if (confirmCallback) confirmCallback();
        toggleModal(false);
    });

    // Hàm bỏ dấu tiếng Việt
    function removeAccents(str) {
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
    }

    // Hàm chuẩn hóa chuỗi lỗi vi phạm
    function normalizeViolation(text) {
        const normalized = removeAccents(text.toLowerCase().trim());
        if (normalized.includes('khong mang the') || normalized.includes('quen the')) return VIOLATIONS.KHONG_MANG_THE;
        if (normalized.includes('di hoc muon') || normalized.includes('tre')) return VIOLATIONS.DI_HOC_MUON;
        if (normalized.includes('khong mac ao doan') || normalized.includes('ao doan')) return VIOLATIONS.KHONG_MAC_AO_DOAN;
        if (normalized.includes('mang dep') || normalized.includes('dep le')) return VIOLATIONS.MANG_DEP_LE;
        if (normalized.includes('tren 50cc')) return VIOLATIONS.DI_XE_50CC;
        if (normalized === 'the') return VIOLATIONS.KHONG_MANG_THE;
        if (normalized === 'muon') return VIOLATIONS.DI_HOC_MUON;
        if (normalized === 'ao') return VIOLATIONS.KHONG_MAC_AO_DOAN;
        if (normalized === 'dep') return VIOLATIONS.MANG_DEP_LE;
        if (normalized === 'xe') return VIOLATIONS.DI_XE_50CC;
        return text;
    }
    
    // Hàm chuyển đổi chế độ xem/sửa
    function toggleEditMode(isEditing) {
        if(isEditing) {
            viewModeButtons.classList.add('hidden');
            editModeButtons.classList.remove('hidden');
            processBtn.disabled = true;
        } else {
            viewModeButtons.classList.remove('hidden');
            editModeButtons.classList.add('hidden');
            processBtn.disabled = false;
        }
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
        }
    });
    
    undoBtn.addEventListener('click', () => {
        if (historyStack.length > 0) {
            processedData = historyStack.pop();
            displayReport(processedData);
        }
    });

    clearBtn.addEventListener('click', () => {
        toggleModal(true, 'Xác nhận Xóa', 'Bạn có chắc chắn muốn xóa toàn bộ báo cáo không? Hành động này không thể hoàn tác.', true, () => {
            processedData = [];
            historyStack = [];
            displayReport([]);
        });
    });

    editBtn.addEventListener('click', () => toggleEditMode(true));
    cancelBtn.addEventListener('click', () => toggleEditMode(false));

    saveBtn.addEventListener('click', () => {
        historyStack.push([...processedData]);
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
    });

    // Sử dụng event delegation để xử lý nút xóa
    reportContainer.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('delete-row-btn')) {
            e.target.closest('tr').remove();
        }
    });

    // --- Hàm phân tích dữ liệu ---
    function parseTextInput(text) {
        const classRegex = /\b(\d{1,2}[a-zA-Z][\d]{0,2})\b/; 
        return text.split('\n').map(line => line.trim()).filter(line => line)
            .map(line => {
                let student = null;
                if (line.includes('-')) {
                    const parts = line.split('-').map(part => part.trim());
                    if (parts.length >= 3) {
                        student = { 'Họ và tên': parts[0], 'Lớp': parts[1], 'Lỗi vi phạm': normalizeViolation(parts.slice(2).join('-').trim()) };
                    }
                } else {
                    const match = line.match(classRegex);
                    if (match) {
                        const className = match[0];
                        const name = line.substring(0, match.index).trim();
                        const violation = line.substring(match.index + className.length).trim();
                        if (name && className && violation) {
                            student = { 'Họ và tên': name, 'Lớp': className, 'Lỗi vi phạm': normalizeViolation(violation) };
                        }
                    }
                }
                if (student) {
                    student.id = crypto.randomUUID();
                    student.timestamp = new Date(); // Thêm thời gian thực
                }
                return student;
            }).filter(s => s !== null);
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
                    const headers = json[0].map(h => h.toString().toLowerCase().trim());
                    const nameIndex = headers.indexOf('họ và tên');
                    const classIndex = headers.indexOf('lớp');
                    const violationIndex = headers.indexOf('lỗi vi phạm');
                    if (nameIndex === -1 || classIndex === -1 || violationIndex === -1) {
                        reject(new Error('Tệp Excel thiếu các cột bắt buộc.'));
                        return;
                    }
                    const students = json.slice(1).map(row => ({
                        id: crypto.randomUUID(), 
                        'Họ và tên': row[nameIndex], 
                        'Lớp': row[classIndex],
                        'Lỗi vi phạm': normalizeViolation(row[violationIndex] ? row[violationIndex].toString() : ''),
                        timestamp: new Date() // Thêm thời gian thực
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
        if (data.length === 0) {
            reportContainer.innerHTML = `<p class="text-gray-400 text-center py-20">Chưa có dữ liệu.</p>`;
            reportActions.classList.add('hidden');
            return;
        }

        reportActions.classList.remove('hidden');
        undoBtn.disabled = historyStack.length === 0;

        const groupedByViolation = data.reduce((acc, student) => {
            const violation = student['Lỗi vi phạm'];
            if (!acc[violation]) acc[violation] = [];
            acc[violation].push(student);
            return acc;
        }, {});

        let reportHTML = `<div class="report-content" style="background-color: white; color: black; padding: 24px; border-radius: 8px;">
                        <div class="report-header text-center pb-4 mb-4">
                            <h2 style="font-size: 24px; font-weight: bold; color: #1a202c;">BÁO CÁO TỔNG HỢP VI PHẠM</h2>
                            <p style="color: #4a5568;">Ngày ${new Date().toLocaleDateString('vi-VN')}</p>
                            <div style="font-size: 14px; color: #718096; margin-top: 8px;">
                                <span><b>Người tạo:</b> ${userInfo.name}</span> | <span><b>Chức vụ:</b> ${userInfo.className}</span>
                            </div>
                        </div>
                        <div style="font-size: 16px;">`;

        const sortedViolations = Object.keys(groupedByViolation).sort();
        for (const violation of sortedViolations) {
            const students = groupedByViolation[violation];
            // [FIXED] Sửa lỗi ngắt dòng trên màn hình lớn
            reportHTML += `<div style="margin-bottom: 24px;">
                            <h3 style="font-size: 18px; font-weight: bold; color: #2d3748; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px;">
                                ${violation.toUpperCase()} - (Tổng số: ${students.length})
                            </h3>
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead style="background-color: #f7fafc;">
                                    <tr>
                                        <th style="padding: 8px; text-align: left; border: 1px solid #e2e8f0; width: 35%; white-space: nowrap;">Họ và tên</th>
                                        <th style="padding: 8px; text-align: left; border: 1px solid #e2e8f0; width: 15%;">Lớp</th>
                                        <th style="padding: 8px; text-align: left; border: 1px solid #e2e8f0; width: 15%; white-space: nowrap;">Thời gian</th>
                                        <th style="padding: 8px; text-align: left; border: 1px solid #e2e8f0; width: ${isEditing ? '25%' : '35%'}; white-space: nowrap;">Lỗi vi phạm</th>
                                        ${isEditing ? '<th style="padding: 8px; text-align: center; border: 1px solid #e2e8f0; width: 10%; white-space: nowrap;">Xóa</th>' : ''}
                                    </tr>
                                </thead>
                                <tbody>`;
            students.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)).forEach((student) => {
                let violationOptionsHTML = '';
                if (isEditing) {
                    const otherOptions = Object.values(VIOLATIONS)
                        .filter(v => v !== student['Lỗi vi phạm'])
                        .map(v => `<option value="${v}">${v}</option>`)
                        .join('');
                    violationOptionsHTML = `<select style="width:100%; border:1px solid #ccc; padding: 4px; border-radius: 4px;">
                        <option value="${student['Lỗi vi phạm']}" selected>${student['Lỗi vi phạm']}</option>
                        ${otherOptions}
                    </select>`;
                } else {
                    violationOptionsHTML = student['Lỗi vi phạm'];
                }

                reportHTML += `<tr data-student-id="${student.id}" data-timestamp="${student.timestamp.toISOString()}">
                        <td style="padding: 8px; border: 1px solid #e2e8f0;" data-field="name" ${isEditing ? 'contenteditable="true"' : ''}>${student['Họ và tên']}</td>
                        <td style="padding: 8px; border: 1px solid #e2e8f0;" data-field="class" ${isEditing ? 'contenteditable="true"' : ''}>${student['Lớp']}</td>
                        <td style="padding: 8px; border: 1px solid #e2e8f0;">${new Date(student.timestamp).toLocaleTimeString('vi-VN')}</td>
                        <td style="padding: 8px; border: 1px solid #e2e8f0;" data-field="violation">${violationOptionsHTML}</td>
                        ${isEditing ? `<td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;"><button class="delete-row-btn" style="background: #e53e3e; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">Xóa</button></td>` : ''}
                    </tr>`;
            });
            reportHTML += `</tbody></table></div>`;
        }
        reportHTML += '</div></div>';
        reportContainer.innerHTML = reportHTML;
    }
    
    exportPngBtn.addEventListener('click', () => {
        const reportElement = reportContainer.querySelector('.report-content');
        if (reportElement) {
            const clonedReport = reportElement.cloneNode(true);

            // Tạo một bản sao để xử lý xuất ảnh mà không ảnh hưởng đến giao diện
            clonedReport.style.position = 'absolute';
            clonedReport.style.left = '-9999px';
            clonedReport.style.top = '0';
            // [FIXED] Giảm chiều rộng để giống hóa đơn hơn
            clonedReport.style.width = '580px'; 
            document.body.appendChild(clonedReport);

            html2canvas(clonedReport, { 
                scale: 2, // Tăng scale để ảnh nét hơn với chiều rộng nhỏ
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
                // Xóa bản sao sau khi hoàn tất
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
                    [], // Dòng trống
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
});