import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getDocument } from '@/services/documents'
import { PageHeader } from '@/components/layout/page-header'
import { DocumentViewer } from '@/components/documents/document-viewer'
import { ErrorState, Skeleton } from '@/components/ui/feedback'

export default function StudentDocumentPage() {
  const { documentId = '' } = useParams()

  const documentQuery = useQuery({
    queryKey: ['document', documentId],
    queryFn: () => getDocument(documentId),
    enabled: Boolean(documentId),
  })

  if (documentQuery.isLoading) {
    return (
      <>
        <Skeleton className="h-10 w-72" />
        <Skeleton className="mt-6 h-32" />
        <Skeleton className="mt-4 h-96" />
      </>
    )
  }

  if (documentQuery.isError || !documentQuery.data) {
    return (
      <>
        <PageHeader
          title="المادة التعليمية"
          breadcrumb={{ label: 'الصفوف', to: '/app/student/classes' }}
        />
        <ErrorState
          title="تعذّر فتح المادة"
          description={
            documentQuery.error?.message ??
            'هذه المادة غير متاحة. قد يكون الدرس غير منشور أو تم حذف الملف.'
          }
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={documentQuery.data.title}
        breadcrumb={{ label: 'الصفوف', to: '/app/student/classes' }}
      />
      <DocumentViewer document={documentQuery.data} />
    </>
  )
}
