import { WorkflowStorageService } from '@/services/workflowStorage'
import type { WorkflowSnapshot } from '@/types/snapshot'

export async function simulatePublishedWorkflows() {
  // Get current workflows
  const workflows = await WorkflowStorageService.getAllWorkflows()

  // For each unique workflow ID, create a few published versions
  const workflowIds = Array.from(new Set(workflows.map(w => w.id)))

  for (const workflowId of workflowIds) {
    const latestDraft = await WorkflowStorageService.getLatestDraft(workflowId)
    if (!latestDraft) continue

    // Create 2-3 published versions with different timestamps
    const publishedVersions = [
      {
        daysAgo: 7,
        nodeCount: Math.max(1, (latestDraft.metadata?.totalNodeCount || 5) - 2),
        connectionCount: Math.max(0, (latestDraft.metadata?.totalConnectionCount || 3) - 1),
        saveCount: 15,
      },
      {
        daysAgo: 3,
        nodeCount: Math.max(1, (latestDraft.metadata?.totalNodeCount || 5) - 1),
        connectionCount: Math.max(0, latestDraft.metadata?.totalConnectionCount || 3),
        saveCount: 28,
      },
      {
        daysAgo: 1,
        nodeCount: latestDraft.metadata?.totalNodeCount || 5,
        connectionCount: latestDraft.metadata?.totalConnectionCount || 3,
        saveCount: 42,
      },
    ]

    for (let index = 0; index < publishedVersions.length; index++) {
      const versionData = publishedVersions[index]
      const publishDate = new Date()
      publishDate.setDate(publishDate.getDate() - versionData.daysAgo)
      publishDate.setHours(publishDate.getHours() - index) // Ensure unique timestamps

      const publishedVersion: WorkflowSnapshot = {
        ...latestDraft,
        isDraft: false,
        isPublished: true,
        publishedAt: publishDate.toISOString(),
        updatedAt: publishDate.toISOString(),
        lastSavedAt: publishDate.toISOString(),
        saveCount: versionData.saveCount,
        metadata: latestDraft.metadata
          ? {
              ...latestDraft.metadata,
              totalNodeCount: versionData.nodeCount,
              totalConnectionCount: versionData.connectionCount,
              tags: ['published', `v${index + 1}`],
            }
          : {
              version: '1.0.0',
              totalNodeCount: versionData.nodeCount,
              totalConnectionCount: versionData.connectionCount,
              tags: ['published', `v${index + 1}`],
            },
      }

      // Save the published version
      await WorkflowStorageService.saveWorkflow(publishedVersion)
    }
  }

  // console.log removed
}
