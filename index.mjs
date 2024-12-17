import { chromium } from "playwright";
import { writeFileSync } from 'fs';

async function getTotalPages(page) {
    const totalPagesText = await page.$eval('.pagination__jumpwrap span', el => el.innerText);
    const totalPagesMatch = totalPagesText.match(/共(\d+)页/);
    if (!totalPagesMatch) {
        throw new Error('No se pudo extraer el número total de páginas');
    }
    return parseInt(totalPagesMatch[1]);
}

async function scrapeCategoryPage(page, pageNumber) {
    await page.goto(`https://minkang.x.yupoo.com/categories/680717?page=${pageNumber}`, { timeout: 60000 });

    const products = await page.$$eval('.categories__children',
        (result) => (
            result.map((el) => {
                const title = el.querySelector('.album__title')?.innerText;
                if (!title) return null;

                const details = el.querySelector('a').href;
                if (!details) return null;

                return { title, details };
            }).filter(product => product !== null)
        )
    );

    return products;
}

async function scrapeCategories(url) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(url, { timeout: 60000 });

    const totalPages = await getTotalPages(page);

    let allProducts = [];

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
        const products = await scrapeCategoryPage(page, pageNumber);
        allProducts = allProducts.concat(products);
    }

    await browser.close();
    return allProducts;
}

async function main() {
    const url = 'https://minkang.x.yupoo.com/categories/680717';
    const allProducts = await scrapeCategories(url);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    for (const product of allProducts) {
        try {
            await page.goto(product.details, { timeout: 120000 }); // Aumenta el tiempo de espera a 120 segundos

            // Captura el texto del atributo `data-src` de las imágenes
            const imageSrcs = await page.$$eval('.showalbum__children.image__main img', imgs => 
                imgs.map(img => img.getAttribute('data-src'))
            );

            console.log(`Imágenes para el producto ${product.details}:`);
            imageSrcs.forEach(src => console.log(src));

        } catch (error) {
            console.error(`Error al cargar la página de detalles del producto: ${product.details}`, error);
        }
    }

    await browser.close();

    writeFileSync('products.json', JSON.stringify(allProducts, null, 2));
}

main().catch(console.error);