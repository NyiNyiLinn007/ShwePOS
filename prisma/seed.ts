import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding ShwePOS database...');

  // Clean existing data
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.settings.deleteMany();

  // Create Settings
  await prisma.settings.create({
    data: {
      id: 'default',
      businessName: 'ShwePOS',
      businessNameMm: 'ရွှေPOS',
      address: 'No. 123, Bogyoke Road, Yangon',
      phone: '09-123456789',
      email: 'info@shwepos.com',
      taxRate: 0,
      currencySymbol: 'K',
      receiptFooter: 'Thank you for shopping with us! / ဝယ်ယူအားပေးမှုအတွက် ကျေးဇူးတင်ပါသည်!',
    },
  });

  // Create Users
  const adminPassword = await hash('admin123', 12);
  const managerPassword = await hash('manager123', 12);
  const cashierPassword = await hash('cashier123', 12);

  const admin = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@shwepos.com',
      password: adminPassword,
      role: 'ADMIN',
      phone: '09-111111111',
    },
  });

  const manager = await prisma.user.create({
    data: {
      name: 'Aung Aung',
      email: 'manager@shwepos.com',
      password: managerPassword,
      role: 'MANAGER',
      phone: '09-222222222',
    },
  });

  const cashier = await prisma.user.create({
    data: {
      name: 'Ma Ma',
      email: 'cashier@shwepos.com',
      password: cashierPassword,
      role: 'CASHIER',
      phone: '09-333333333',
    },
  });

  console.log('✅ Users created');

  // Create Categories
  const categories = await Promise.all([
    prisma.category.create({
      data: { name: 'Beverages', nameMm: 'အချိုရည်များ', slug: 'beverages', description: 'Drinks and beverages' },
    }),
    prisma.category.create({
      data: { name: 'Snacks', nameMm: 'မုန့်များ', slug: 'snacks', description: 'Snacks and chips' },
    }),
    prisma.category.create({
      data: { name: 'Rice & Noodles', nameMm: 'ဆန်နှင့်ခေါက်ဆွဲ', slug: 'rice-noodles', description: 'Rice, noodles and staples' },
    }),
    prisma.category.create({
      data: { name: 'Cooking Oil', nameMm: 'ဆီ', slug: 'cooking-oil', description: 'Cooking oils and fats' },
    }),
    prisma.category.create({
      data: { name: 'Personal Care', nameMm: 'ကိုယ်ပိုင်သုံးပစ္စည်း', slug: 'personal-care', description: 'Soaps, shampoo, etc.' },
    }),
    prisma.category.create({
      data: { name: 'Household', nameMm: 'အိမ်သုံးပစ္စည်း', slug: 'household', description: 'Cleaning and household items' },
    }),
    prisma.category.create({
      data: { name: 'Dairy & Eggs', nameMm: 'နို့နှင့်ဥ', slug: 'dairy-eggs', description: 'Milk, eggs, cheese' },
    }),
    prisma.category.create({
      data: { name: 'Condiments', nameMm: 'ဟင်းချက်အရသာ', slug: 'condiments', description: 'Sauces, spices, seasonings' },
    }),
  ]);

  console.log('✅ Categories created');

  // Create Products
  const products = [
    // Beverages
    { name: 'Coca-Cola 330ml', nameMm: 'ကိုကာကိုလာ', sku: 'BEV-001', barcode: '8901234560001', categoryId: categories[0].id, costPrice: 350, sellingPrice: 500, stockQuantity: 200, unit: 'pcs' },
    { name: 'Pepsi 330ml', nameMm: 'ပက်စီ', sku: 'BEV-002', barcode: '8901234560002', categoryId: categories[0].id, costPrice: 350, sellingPrice: 500, stockQuantity: 180, unit: 'pcs' },
    { name: 'Sprite 330ml', nameMm: 'စပရိုက်', sku: 'BEV-003', barcode: '8901234560003', categoryId: categories[0].id, costPrice: 350, sellingPrice: 500, stockQuantity: 150, unit: 'pcs' },
    { name: 'Alpine Water 1L', nameMm: 'အယ်လ်ပိုင်းရေ', sku: 'BEV-004', barcode: '8901234560004', categoryId: categories[0].id, costPrice: 200, sellingPrice: 300, stockQuantity: 300, unit: 'pcs' },
    { name: 'Myanmar Beer 330ml', nameMm: 'မြန်မာဘီယာ', sku: 'BEV-005', barcode: '8901234560005', categoryId: categories[0].id, costPrice: 800, sellingPrice: 1200, stockQuantity: 100, unit: 'pcs' },
    { name: 'Red Bull 250ml', nameMm: 'ရက်ဘူး', sku: 'BEV-006', barcode: '8901234560006', categoryId: categories[0].id, costPrice: 600, sellingPrice: 900, stockQuantity: 80, unit: 'pcs' },
    { name: 'Green Tea 500ml', nameMm: 'လက်ဖက်ရည်အစိမ်း', sku: 'BEV-007', barcode: '8901234560007', categoryId: categories[0].id, costPrice: 400, sellingPrice: 600, stockQuantity: 120, unit: 'pcs' },

    // Snacks
    { name: 'Lay\'s Chips Original', nameMm: 'လေးချစ်ပ်', sku: 'SNK-001', barcode: '8901234560010', categoryId: categories[1].id, costPrice: 500, sellingPrice: 800, stockQuantity: 100, unit: 'pcs' },
    { name: 'Oreo Cookies', nameMm: 'အိုရီယို', sku: 'SNK-002', barcode: '8901234560011', categoryId: categories[1].id, costPrice: 600, sellingPrice: 1000, stockQuantity: 80, unit: 'pcs' },
    { name: 'KitKat Chocolate', nameMm: 'ကစ်ကတ်', sku: 'SNK-003', barcode: '8901234560012', categoryId: categories[1].id, costPrice: 400, sellingPrice: 700, stockQuantity: 120, unit: 'pcs' },
    { name: 'Pringles Sour Cream', nameMm: 'ပရင်းဂလ်', sku: 'SNK-004', barcode: '8901234560013', categoryId: categories[1].id, costPrice: 1500, sellingPrice: 2500, stockQuantity: 50, unit: 'pcs' },
    { name: 'Cup Noodles', nameMm: 'ခွက်ခေါက်ဆွဲ', sku: 'SNK-005', barcode: '8901234560014', categoryId: categories[1].id, costPrice: 300, sellingPrice: 500, stockQuantity: 200, unit: 'pcs' },

    // Rice & Noodles
    { name: 'Shwe Bo Rice 10kg', nameMm: 'ရွှေဘိုဆန်', sku: 'RIC-001', barcode: '8901234560020', categoryId: categories[2].id, costPrice: 18000, sellingPrice: 22000, stockQuantity: 50, unit: 'pack' },
    { name: 'Paw San Rice 5kg', nameMm: 'ပေါ်ဆန်းဆန်', sku: 'RIC-002', barcode: '8901234560021', categoryId: categories[2].id, costPrice: 15000, sellingPrice: 18000, stockQuantity: 40, unit: 'pack' },
    { name: 'Dried Noodles 400g', nameMm: 'ခေါက်ဆွဲခြောက်', sku: 'RIC-003', barcode: '8901234560022', categoryId: categories[2].id, costPrice: 500, sellingPrice: 800, stockQuantity: 150, unit: 'pack' },
    { name: 'Instant Noodles (5pk)', nameMm: 'အသင့်စားခေါက်ဆွဲ', sku: 'RIC-004', barcode: '8901234560023', categoryId: categories[2].id, costPrice: 800, sellingPrice: 1200, stockQuantity: 100, unit: 'pack' },
    { name: 'Vermicelli 200g', nameMm: 'ကျောက်ကြော်', sku: 'RIC-005', barcode: '8901234560024', categoryId: categories[2].id, costPrice: 400, sellingPrice: 600, stockQuantity: 90, unit: 'pack' },

    // Cooking Oil
    { name: 'Palm Oil 1L', nameMm: 'စားအုန်းဆီ', sku: 'OIL-001', barcode: '8901234560030', categoryId: categories[3].id, costPrice: 3000, sellingPrice: 3800, stockQuantity: 80, unit: 'pcs' },
    { name: 'Peanut Oil 1L', nameMm: 'မြေပဲဆီ', sku: 'OIL-002', barcode: '8901234560031', categoryId: categories[3].id, costPrice: 4500, sellingPrice: 5500, stockQuantity: 60, unit: 'pcs' },
    { name: 'Sesame Oil 500ml', nameMm: 'နှမ်းဆီ', sku: 'OIL-003', barcode: '8901234560032', categoryId: categories[3].id, costPrice: 3500, sellingPrice: 4500, stockQuantity: 40, unit: 'pcs' },

    // Personal Care
    { name: 'Lux Soap', nameMm: 'လပ်ဆပ်ပြာ', sku: 'PC-001', barcode: '8901234560040', categoryId: categories[4].id, costPrice: 400, sellingPrice: 700, stockQuantity: 150, unit: 'pcs' },
    { name: 'Head & Shoulders 170ml', nameMm: 'ခေါင်းလျှော်ရည်', sku: 'PC-002', barcode: '8901234560041', categoryId: categories[4].id, costPrice: 2500, sellingPrice: 3500, stockQuantity: 60, unit: 'pcs' },
    { name: 'Colgate Toothpaste', nameMm: 'သွားတိုက်ဆေး', sku: 'PC-003', barcode: '8901234560042', categoryId: categories[4].id, costPrice: 800, sellingPrice: 1200, stockQuantity: 100, unit: 'pcs' },
    { name: 'Tissue Paper (10pk)', nameMm: 'တစ်ရှူး', sku: 'PC-004', barcode: '8901234560043', categoryId: categories[4].id, costPrice: 1500, sellingPrice: 2200, stockQuantity: 80, unit: 'pack' },

    // Household  
    { name: 'Detergent Powder 1kg', nameMm: 'ဆပ်ပြာမှုန့်', sku: 'HH-001', barcode: '8901234560050', categoryId: categories[5].id, costPrice: 1500, sellingPrice: 2200, stockQuantity: 70, unit: 'pack' },
    { name: 'Dish Soap 500ml', nameMm: 'ပန်းကန်ဆေးရည်', sku: 'HH-002', barcode: '8901234560051', categoryId: categories[5].id, costPrice: 800, sellingPrice: 1200, stockQuantity: 90, unit: 'pcs' },
    { name: 'Floor Cleaner 1L', nameMm: 'ကြမ်းတိုက်ရည်', sku: 'HH-003', barcode: '8901234560052', categoryId: categories[5].id, costPrice: 1200, sellingPrice: 1800, stockQuantity: 50, unit: 'pcs' },
    { name: 'Garbage Bags (20pcs)', nameMm: 'အမှိုက်အိတ်', sku: 'HH-004', barcode: '8901234560053', categoryId: categories[5].id, costPrice: 600, sellingPrice: 1000, stockQuantity: 5, lowStockThreshold: 10, unit: 'pack' },

    // Dairy & Eggs
    { name: 'Fresh Milk 1L', nameMm: 'နို့', sku: 'DRY-001', barcode: '8901234560060', categoryId: categories[6].id, costPrice: 1800, sellingPrice: 2500, stockQuantity: 30, unit: 'pcs' },
    { name: 'Eggs (10 pcs)', nameMm: 'ကြက်ဥ', sku: 'DRY-002', barcode: '8901234560061', categoryId: categories[6].id, costPrice: 2000, sellingPrice: 2800, stockQuantity: 40, unit: 'pack' },
    { name: 'Condensed Milk', nameMm: 'နို့ဆီခဲ', sku: 'DRY-003', barcode: '8901234560062', categoryId: categories[6].id, costPrice: 800, sellingPrice: 1200, stockQuantity: 60, unit: 'pcs' },
    { name: 'Butter 200g', nameMm: 'ထောပတ်', sku: 'DRY-004', barcode: '8901234560063', categoryId: categories[6].id, costPrice: 2500, sellingPrice: 3500, stockQuantity: 8, lowStockThreshold: 10, unit: 'pcs' },

    // Condiments
    { name: 'Fish Sauce 700ml', nameMm: 'ငါးငံပြာရည်', sku: 'CON-001', barcode: '8901234560070', categoryId: categories[7].id, costPrice: 1200, sellingPrice: 1800, stockQuantity: 80, unit: 'pcs' },
    { name: 'Soy Sauce 300ml', nameMm: 'ပဲငံပြာရည်', sku: 'CON-002', barcode: '8901234560071', categoryId: categories[7].id, costPrice: 600, sellingPrice: 1000, stockQuantity: 100, unit: 'pcs' },
    { name: 'Chili Flakes 100g', nameMm: 'ငရုတ်သီးမှုန့်', sku: 'CON-003', barcode: '8901234560072', categoryId: categories[7].id, costPrice: 500, sellingPrice: 800, stockQuantity: 70, unit: 'pack' },
    { name: 'Sugar 1kg', nameMm: 'သကြား', sku: 'CON-004', barcode: '8901234560073', categoryId: categories[7].id, costPrice: 1500, sellingPrice: 2000, stockQuantity: 100, unit: 'pack' },
    { name: 'Salt 500g', nameMm: 'ဆား', sku: 'CON-005', barcode: '8901234560074', categoryId: categories[7].id, costPrice: 300, sellingPrice: 500, stockQuantity: 120, unit: 'pack' },
    { name: 'MSG 100g', nameMm: 'အချိုမှုန့်', sku: 'CON-006', barcode: '8901234560075', categoryId: categories[7].id, costPrice: 400, sellingPrice: 700, stockQuantity: 3, lowStockThreshold: 10, unit: 'pack' },
  ];

  for (const product of products) {
    await prisma.product.create({ data: product });
  }

  console.log(`✅ ${products.length} Products created`);

  // Create Customers
  const customers = [
    { name: 'U Kyaw Kyaw', phone: '09-400000001', address: 'Tamwe, Yangon' },
    { name: 'Daw Aye Aye', phone: '09-400000002', address: 'Insein, Yangon' },
    { name: 'Ko Min Min', phone: '09-400000003', address: 'Hlaing, Yangon' },
    { name: 'Ma Thin Thin', phone: '09-400000004', address: 'Sanchaung, Yangon' },
    { name: 'U Zaw Win', phone: '09-400000005', address: 'Bahan, Yangon' },
    { name: 'Daw Khin Mar', phone: '09-400000006', address: 'Kamayut, Yangon' },
    { name: 'Ko Aung Ko', phone: '09-400000007', address: 'Dagon, Yangon' },
    { name: 'Ma Su Su', phone: '09-400000008', address: 'Latha, Yangon' },
  ];

  for (const customer of customers) {
    await prisma.customer.create({ data: customer });
  }

  console.log(`✅ ${customers.length} Customers created`);

  // Create some sample sales for the last 7 days
  const allProducts = await prisma.product.findMany();
  const allCustomers = await prisma.customer.findMany();

  for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
    const date = new Date();
    date.setDate(date.getDate() - dayOffset);
    date.setHours(0, 0, 0, 0);

    const salesCount = Math.floor(Math.random() * 8) + 3; // 3-10 sales per day

    for (let s = 0; s < salesCount; s++) {
      const itemCount = Math.floor(Math.random() * 5) + 1; // 1-5 items per sale
      const saleItems: { productId: string; quantity: number; unitPrice: number; discount: number; total: number }[] = [];
      let subtotal = 0;

      for (let i = 0; i < itemCount; i++) {
        const product = allProducts[Math.floor(Math.random() * allProducts.length)];
        const quantity = Math.floor(Math.random() * 3) + 1;
        const total = product.sellingPrice * quantity;
        subtotal += total;
        saleItems.push({
          productId: product.id,
          quantity,
          unitPrice: product.sellingPrice,
          discount: 0,
          total,
        });
      }

      const discountPercent = Math.random() < 0.2 ? Math.floor(Math.random() * 10) + 1 : 0;
      const discountAmount = subtotal * (discountPercent / 100);
      const totalAmount = subtotal - discountAmount;
      const paidAmount = Math.ceil(totalAmount / 1000) * 1000;
      const changeAmount = paidAmount - totalAmount;

      const saleDate = new Date(date);
      saleDate.setHours(8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60));

      const paymentMethods = ['CASH', 'CASH', 'CASH', 'CARD', 'MOBILE_BANKING'];
      const customer = Math.random() < 0.4 ? allCustomers[Math.floor(Math.random() * allCustomers.length)] : null;

      const invoiceNum = `INV-${saleDate.getFullYear()}${String(saleDate.getMonth() + 1).padStart(2, '0')}${String(saleDate.getDate()).padStart(2, '0')}-${String(s + 1).padStart(3, '0')}`;

      await prisma.sale.create({
        data: {
          invoiceNumber: invoiceNum,
          userId: [admin.id, manager.id, cashier.id][Math.floor(Math.random() * 3)],
          customerId: customer?.id || null,
          subtotal,
          discountAmount,
          taxAmount: 0,
          totalAmount,
          paidAmount,
          changeAmount,
          paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
          status: 'COMPLETED',
          createdAt: saleDate,
          items: {
            create: saleItems,
          },
        },
      });
    }
  }

  console.log('✅ Sample sales created');

  // Create sample expenses
  const expenseCategories = ['Rent', 'Utilities', 'Supplies', 'Transport', 'Salary'];
  for (let i = 0; i < 10; i++) {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 30));

    await prisma.expense.create({
      data: {
        category: expenseCategories[Math.floor(Math.random() * expenseCategories.length)],
        amount: (Math.floor(Math.random() * 50) + 5) * 1000,
        description: `Sample expense ${i + 1}`,
        userId: admin.id,
        date,
      },
    });
  }

  console.log('✅ Sample expenses created');
  console.log('\n🎉 Database seeded successfully!');
  console.log('\n📧 Login Credentials:');
  console.log('   Admin:   admin@shwepos.com / admin123');
  console.log('   Manager: manager@shwepos.com / manager123');
  console.log('   Cashier: cashier@shwepos.com / cashier123');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
