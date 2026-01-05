use tauri::{AppHandle, command, Runtime};

use crate::models::*;
use crate::Result;
use crate::HulaExt;

#[command]
pub(crate) async fn ping<R: Runtime>(
    app: AppHandle<R>,
    payload: PingRequest,
) -> Result<PingResponse> {
    app.hula().ping(payload)
}

#[command]
#[cfg(mobile)]
pub(crate) async fn show_notification<R: Runtime>(
    app: AppHandle<R>,
    payload: ShowNotificationRequest,
) -> Result<ShowNotificationResponse> {
    app.hula().show_notification(payload)
}

#[command]
#[cfg(mobile)]
pub(crate) async fn cancel_notification<R: Runtime>(
    app: AppHandle<R>,
    payload: CancelNotificationRequest,
) -> Result<CancelNotificationResponse> {
    app.hula().cancel_notification(payload)
}

#[command]
#[cfg(mobile)]
pub(crate) async fn start_background_service<R: Runtime>(
    app: AppHandle<R>,
) -> Result<BackgroundServiceResponse> {
    app.hula().start_background_service()
}

#[command]
#[cfg(mobile)]
pub(crate) async fn stop_background_service<R: Runtime>(
    app: AppHandle<R>,
) -> Result<BackgroundServiceResponse> {
    app.hula().stop_background_service()
}

#[command]
#[cfg(mobile)]
pub(crate) async fn get_launch_intent_data<R: Runtime>(
    app: AppHandle<R>,
) -> Result<LaunchIntentDataResponse> {
    app.hula().get_launch_intent_data()
}

#[command]
#[cfg(mobile)]
pub(crate) async fn clear_launch_intent_data<R: Runtime>(
    app: AppHandle<R>,
) -> Result<BackgroundServiceResponse> {
    app.hula().clear_launch_intent_data()
}