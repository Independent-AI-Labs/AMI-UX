import { startCms } from './main.js'

startCms()
  .catch((err) => {
    const el = document.getElementById('content') || document.body
    if (el) el.textContent = 'Failed to initialize doc viewer.'
    console.error(err)
  })

