import { Metadata } from 'next'
import DocViewer from './DocViewer'

export const metadata: Metadata = {
  title: 'Docs - Embedded',
  icons: {
    icon: '/favicon.svg',
  },
}

type SearchParams = Promise<{
  embed?: string
  rootKey?: string
  path?: string
  label?: string
  focus?: string
  mode?: string
}>

export default async function DocPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  return <DocViewer searchParams={params} />
}
