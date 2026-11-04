export const connectByClient = (id) => {
  //Open the URL protocol in the same window: rustdesk://<id>
  // window.open(`rustdesk://${row.id}`)
  let a = document.createElement('a')
  a.href = `rustdesk://${encodeURIComponent(String(id))}`
  a.target = '_self'
  a.click()

}
