"""Templates API implementation."""

from typing import TYPE_CHECKING

from .types import (
    RegisterTemplatesRequest, RegisterTemplatesResponse,
    ListTemplatesResponse,
    ListCategoriesResponse,
    RegisterCategoriesRequest, RegisterCategoriesResponse,
    UploadBundleRequest, UploadBundleResponse,
    NodeTemplate,
    UpdateTemplateResponse,
    DeleteTemplateResponse,
)

if TYPE_CHECKING:
    from .client import ZealClient


class TemplatesAPI:
    """Templates API for node template management."""
    
    def __init__(self, client: "ZealClient"):
        self._client = client
    
    async def list_categories(self) -> ListCategoriesResponse:
        """List available node template categories."""
        response = await self._client._make_request(
            "GET",
            "/api/zip/categories"
        )
        response.raise_for_status()
        return ListCategoriesResponse(**response.json())

    async def register_categories(self, request: RegisterCategoriesRequest) -> RegisterCategoriesResponse:
        """Register new categories and subcategories.
        Upserts by name — existing categories get new subcategories merged.
        """
        response = await self._client._make_request(
            "POST",
            "/api/zip/categories",
            json_data=request.dict(by_alias=True, exclude_none=True)
        )
        response.raise_for_status()
        return RegisterCategoriesResponse(**response.json())

    async def upload_bundle(self, request: UploadBundleRequest) -> UploadBundleResponse:
        """Upload a Web Component bundle for custom node rendering.
        Returns bundle metadata including bundle_id for template.display.
        """
        response = await self._client._make_request(
            "POST",
            "/api/zip/components",
            json_data=request.dict(by_alias=True, exclude_none=True)
        )
        response.raise_for_status()
        return UploadBundleResponse(**response.json())

    async def register(self, request: RegisterTemplatesRequest) -> RegisterTemplatesResponse:
        """Register node templates."""
        response = await self._client._make_request(
            "POST",
            "/api/zip/templates/register",
            json_data=request.dict(by_alias=True, exclude_none=True)
        )
        response.raise_for_status()
        return RegisterTemplatesResponse(**response.json())
    
    async def list(self, namespace: str) -> ListTemplatesResponse:
        """List available templates in a namespace."""
        params = {"namespace": namespace}
        
        response = await self._client._make_request(
            "GET",
            "/api/zip/templates/list",
            params=params
        )
        response.raise_for_status()
        return ListTemplatesResponse(**response.json())
    
    async def update(
        self,
        namespace: str,
        template_id: str,
        template: NodeTemplate
    ) -> UpdateTemplateResponse:
        """Update a template."""
        params = {"namespace": namespace, "templateId": template_id}
        
        response = await self._client._make_request(
            "PATCH",
            "/api/zip/templates/update",
            params=params,
            json_data=template.dict(by_alias=True, exclude_none=True)
        )
        response.raise_for_status()
        return UpdateTemplateResponse(**response.json())
    
    async def delete(self, namespace: str, template_id: str) -> DeleteTemplateResponse:
        """Delete a template."""
        params = {"namespace": namespace, "templateId": template_id}
        
        response = await self._client._make_request(
            "DELETE",
            "/api/zip/templates/delete",
            params=params
        )
        response.raise_for_status()
        return DeleteTemplateResponse(**response.json())