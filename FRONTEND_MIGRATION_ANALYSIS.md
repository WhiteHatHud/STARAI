# Frontend Migration Analysis
*Generated: 2025-11-07*

## Executive Summary

**Old Frontend:** 22 page files with complete functionality
**New Frontend:** 8 page files with mostly placeholder content

## Feature Comparison

### ✅ Implemented in NewFrontend
1. **AuthPage** - Login (OAuth2 token flow) ✓
2. **HomePage** - Placeholder UI only (needs real API)
3. **ReportDashboardPage** - Placeholder
4. **ReportEditorPage** - Placeholder
5. **InstructionsPage** - Static content
6. **NotFoundPage** - Static content

### ❌ Missing from NewFrontend (from OldFrontend)

#### Core Features
1. **DatasetDetail** - View details of uploaded datasets
2. **MyFolders** - Folder and document management
   - FolderManager
   - UploadManager
3. **MyTemplates** - Template management
   - TemplatePage
   - TemplateUploadGenerator
   - TemplateManager
4. **AdminDashboard** - Admin functionality
   - CreateBatch
   - UserGeneratedContent
   - DownloadAll
   - UserDocuments
   - AdminSettingsPage

#### Presentation/Slides Features
5. **MySlides**
   - SlideDashboardPage
   - SlideCreatePage
   - SlideOutlinesPage
6. **SlideTemplates** - Slide template management
7. **PresetGeneration** - Document to content bridge

#### Reports
8. **GeneratedForms**
   - CustomReportViewer
   - CustomStudyDashboardPage

### Key Infrastructure Missing

#### State Management
- **Zustand store** (frontend/src/store.js) - NOT in newfrontend
  - Auth state (token, user, isAuthenticated)
  - Cases state
  - Sticky notes
  - Form sharing
  - Presentation state
  - Sidebar state

#### API Integration
- Axios interceptors for automatic token attachment
- Protected route wrapper
- Session expiration handling

#### Components
- **MainLayout** - Sidebar, header, footer wrapper
- **AppSidebar** - Navigation sidebar
- **CurrentlyProcessingContent** - Progress tracking
- **ProgressStatus** - Status indicators
- **DocumentList** - File list component
- Many other shared components

## Critical Path for Minimal Functionality

To get login + upload working:

### Phase 1: Core Infrastructure (Required)
1. ✅ Login with OAuth2 - DONE
2. Copy Zustand store
3. Set up axios interceptors
4. Create protected route wrapper
5. Add MainLayout wrapper

### Phase 2: HomePage File Upload
1. Remove placeholder data
2. Implement real API calls:
   - GET `/anomaly/datasets/` - List uploaded files
   - POST `/anomaly/datasets/upload` - Upload file
3. File validation (.xlsx, .csv only)
4. Upload progress tracking
5. Error handling

### Phase 3: DatasetDetail (View uploaded file)
1. Create DatasetDetailPage
2. Implement API call to view dataset
3. Add route to App.tsx

## API Endpoints Used (from old frontend)

### Auth
- `POST /auth/token` - Login ✓
- `GET /auth/users/me` - Get current user ✓

### Datasets
- `GET /anomaly/datasets/` - List all datasets
- `POST /anomaly/datasets/upload` - Upload dataset file
- `GET /anomaly/datasets/{id}` - Get dataset details
- `DELETE /anomaly/datasets/{id}` - Delete dataset

### Analysis (if implemented)
- `GET /anomaly/analysis-sessions?status=processing` - Track progress

## Recommendations

### Option A: Full Migration (Complete)
**Time:** 2-3 days
**Scope:** Migrate all 22 pages + components + infrastructure
**Pros:** Full feature parity
**Cons:** Very time-consuming

### Option B: Minimal Viable Product (Recommended)
**Time:** 2-4 hours
**Scope:** Login + Upload + View datasets
**Pros:** Quick, testable, functional
**Cons:** Missing advanced features

### Option C: Hybrid Approach
**Time:** 4-8 hours
**Scope:** Core features only (Login, Upload, View, Reports)
**Pros:** Balance of speed and functionality
**Cons:** Still missing admin/slides/templates

## Next Steps

1. User decides on approach
2. Implement core infrastructure (store, interceptors)
3. Migrate HomePage with real upload
4. Test login + upload flow
5. Iterate on additional features as needed
