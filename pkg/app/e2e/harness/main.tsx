// The page the browser test draws: the Linked sources view on its own, in the
// design tokens and gui's sheet, with no shell around it. `?theme=dark` for dark.
import { createRoot } from 'react-dom/client'
import { GuiProvider } from '@hanzo/gui'
import { css, monochrome } from '@hanzo/ui/gui-config'
import '@hanzo/design/styles.css'
import '@hanzo/design/roles.css'
import { Sources } from '../../src/Sources'

const theme = new URLSearchParams(location.search).get('theme') === 'dark' ? 'dark' : 'light'
document.documentElement.classList.add(theme === 'dark' ? 't_dark' : 't_light')
document.documentElement.setAttribute('data-theme', theme)
const sheet = document.createElement('style')
sheet.textContent = `${css(monochrome)} body{margin:0;background:var(--background);color:var(--foreground);font-family:var(--font-sans,system-ui)}`
document.head.append(sheet)

createRoot(document.getElementById('root')!).render(
  <GuiProvider config={monochrome} defaultTheme={theme} disableInjectCSS>
    <div style={{ maxWidth: 860, padding: 20, margin: '0 auto' }}>
      <Sources />
    </div>
  </GuiProvider>,
)
