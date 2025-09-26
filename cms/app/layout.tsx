export const metadata = {
  title: 'AMI Data Portal',
  description: 'Secure tooling and content management surface for AMI operators.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
