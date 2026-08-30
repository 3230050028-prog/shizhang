const pad = (value: number) => String(value).padStart(2, '0')

export const toLocalDate = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const toLocalMonth = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}`

