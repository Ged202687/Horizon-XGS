import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Chemins relatifs, resolus par la balise <base> posee dans index.html :
  // Horizon fonctionne a sa propre adresse comme sous le portail XGS.
  base: './',
  build: {
    outDir: 'dist',
  },
})
