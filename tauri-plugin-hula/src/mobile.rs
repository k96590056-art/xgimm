use serde::de::DeserializeOwned;
use tauri::{
  plugin::{PluginApi, PluginHandle},
  AppHandle, Runtime,
};

use crate::models::*;

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_hula);

// initializes the Kotlin or Swift plugin classes
pub fn init<R: Runtime, C: DeserializeOwned>(
  _app: &AppHandle<R>,
  api: PluginApi<R, C>,
) -> crate::Result<Hula<R>> {
  #[cfg(target_os = "android")]
  let handle = api.register_android_plugin("com.plugin.hula", "HulaPlugin")?;
  #[cfg(target_os = "ios")]
  let handle = api.register_ios_plugin(init_plugin_hula)?;
  Ok(Hula(handle))
}

/// Access to the hula APIs.
pub struct Hula<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> Hula<R> {
  pub fn ping(&self, payload: PingRequest) -> crate::Result<PingResponse> {
    self
      .0
      .run_mobile_plugin("ping", payload)
      .map_err(Into::into)
  }

  pub fn show_notification(&self, payload: ShowNotificationRequest) -> crate::Result<ShowNotificationResponse> {
    self
      .0
      .run_mobile_plugin("showNotification", payload)
      .map_err(Into::into)
  }

  pub fn cancel_notification(&self, payload: CancelNotificationRequest) -> crate::Result<CancelNotificationResponse> {
    self
      .0
      .run_mobile_plugin("cancelNotification", payload)
      .map_err(Into::into)
  }

  pub fn start_background_service(&self) -> crate::Result<BackgroundServiceResponse> {
    self
      .0
      .run_mobile_plugin("startBackgroundService", ())
      .map_err(Into::into)
  }

  pub fn stop_background_service(&self) -> crate::Result<BackgroundServiceResponse> {
    self
      .0
      .run_mobile_plugin("stopBackgroundService", ())
      .map_err(Into::into)
  }

  pub fn get_launch_intent_data(&self) -> crate::Result<LaunchIntentDataResponse> {
    self
      .0
      .run_mobile_plugin("getLaunchIntentData", ())
      .map_err(Into::into)
  }

  pub fn clear_launch_intent_data(&self) -> crate::Result<BackgroundServiceResponse> {
    self
      .0
      .run_mobile_plugin("clearLaunchIntentData", ())
      .map_err(Into::into)
  }
}
