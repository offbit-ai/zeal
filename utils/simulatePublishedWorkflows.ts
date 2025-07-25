import { WorkflowStorageService } from '@/services/workflowStorage'
import type { WorkflowSnapshot } from '@/types/snapshot'

export function simulatePublishedWorkflows() {
  // Get current workflows
  const workflows = WorkflowStorageService.getAllWorkflows()
  
  // For each unique workflow ID, create a few published versions
  const workflowIds = Array.from(new Set(workflows.map(w => w.id)))
  
  workflowIds.forEach(workflowId => {
    const latestDraft = WorkflowStorageService.getLatestDraft(workflowId)
    if (!latestDraft) return
    
    // Create 2-3 published versions with different timestamps
    const publishedVersions = [
      {
        daysAgo: 7,
        nodeCount: Math.max(1, (latestDraft.metadata?.nodeCount || 5) - 2),
        connectionCount: Math.max(0, (latestDraft.metadata?.connectionCount || 3) - 1),
        saveCount: 15
      },
      {
        daysAgo: 3,
        nodeCount: Math.max(1, (latestDraft.metadata?.nodeCount || 5) - 1),
        connectionCount: Math.max(0, (latestDraft.metadata?.connectionCount || 3)),
        saveCount: 28
      },
      {
        daysAgo: 1,
        nodeCount: latestDraft.metadata?.nodeCount || 5,
        connectionCount: latestDraft.metadata?.connectionCount || 3,
        saveCount: 42
      }
    ]
    
    publishedVersions.forEach((versionData, index) => {
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
        metadata: {
          ...latestDraft.metadata,
          nodeCount: versionData.nodeCount,
          connectionCount: versionData.connectionCount,
          tags: ['published', `v${index + 1}`]
        }
      }
      
      // Save the published version
      WorkflowStorageService.saveWorkflow(publishedVersion)
    })
  })
  
  console.log('Simulated published workflows created successfully')
}