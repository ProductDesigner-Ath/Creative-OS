# Local video intake

Run this local-only service with:

```powershell
cd D:\Creative-OS
npm.cmd run start:video-intake
```

Open http://127.0.0.1:47832. Choose one reference video and select **Upload and analyze**.

The service stores the uploaded source, sampled PNG frames, and `report.json` under `.local/video-intake/jobs`. Git ignores this entire location. It accepts MP4, MOV, M4V, WebM, and AVI files up to 1 GB, binds only to the local computer, and rejects cross-origin browser requests.

The first version samples 8–24 evenly spaced frames and estimates major full-frame visual changes. It gives Creative OS timing evidence for an AE reconstruction plan without requiring After Effects during intake. It cannot yet recognize objects, typography, effects, or individual layer animation; those are the next analysis capabilities.
