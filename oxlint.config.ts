import { defineConfig } from 'oxlint'

export default defineConfig({
    plugins: ['import'],
    categories: {
        correctness: 'error',
    },
    options: {
        typeAware: true,
    },
})
