import { NextRequest, NextResponse } from 'next/server'
import { getPresignedUploadUrl, generateFileKey } from '@/lib/s3-client'

export async function POST(request: NextRequest) {
  try {
    const { fileName, fileType, fileSize } = await request.json()

    if (!fileName || !fileType) {
      return NextResponse.json({ error: 'fileName and fileType are required' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/webm',
      'video/mp4',
      'video/webm',
      'video/ogg',
    ]

    if (!allowedTypes.includes(fileType)) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
    }

    // Determine category
    const category = fileType.startsWith('image/')
      ? 'image'
      : fileType.startsWith('audio/')
        ? 'audio'
        : fileType.startsWith('video/')
          ? 'video'
          : 'other'

    // Generate unique key
    const key = generateFileKey(category, fileName)

    // Generate presigned URL
    const presignedUrl = await getPresignedUploadUrl(key, fileType)

    // Generate public URL that will be accessible after upload
    const publicUrl = `${process.env.NEXT_PUBLIC_MINIO_URL || 'http://localhost:9000'}/${process.env.MINIO_BUCKET || 'zeal-uploads'}/${key}`

    return NextResponse.json({
      presignedUrl,
      publicUrl,
      key,
    })
  } catch (error) {
    console.error('Presigned URL error:', error)
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 })
  }
}
