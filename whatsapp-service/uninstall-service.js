const { Service } = require('node-windows');
const path = require('path');

const svc = new Service({
    name:   'ShaabWhatsApp',
    script: path.join(__dirname, 'index.js')
});

svc.on('uninstall', () => {
    console.log('✅ تم إلغاء تثبيت الخدمة بنجاح');
});

svc.uninstall();
