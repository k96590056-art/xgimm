package com.luohuo.flex.oauth.service.impl;

import cn.dev33.satoken.config.SaTokenConfig;
import cn.dev33.satoken.session.SaSession;
import cn.dev33.satoken.stp.StpUtil;
import cn.dev33.satoken.temp.SaTempUtil;
import cn.hutool.core.bean.BeanUtil;
import cn.hutool.json.JSONObject;
import com.luohuo.basic.exception.BizException;
import com.luohuo.basic.utils.SpringUtils;
import com.luohuo.flex.base.vo.save.user.BaseEmployeeOrgRelSaveVO;
import com.luohuo.flex.base.vo.save.user.BaseEmployeeRoleRelSaveVO;
import com.luohuo.flex.im.api.ImUserApi;
import com.luohuo.flex.im.api.vo.UserRegisterVo;
import com.luohuo.flex.im.enums.UserTypeEnum;
import com.luohuo.flex.model.entity.system.SysUser;
import com.luohuo.flex.model.event.UserOnlineEvent;
import com.luohuo.flex.oauth.emuns.LoginEnum;
import com.luohuo.flex.oauth.event.LoginEvent;
import com.luohuo.flex.oauth.event.model.LoginStatusDTO;
import com.luohuo.flex.oauth.vo.result.LoginResultVO;
import com.luohuo.flex.common.utils.ToolsUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import com.luohuo.basic.cache.redis2.CacheResult;
import com.luohuo.basic.cache.repository.CacheOps;
import com.luohuo.basic.context.ContextUtil;
import com.luohuo.basic.model.cache.CacheKey;
import com.luohuo.basic.utils.ArgumentAssert;
import com.luohuo.flex.base.entity.tenant.DefUser;
import com.luohuo.flex.base.entity.user.BaseEmployee;
import com.luohuo.flex.base.entity.user.BaseOrg;
import com.luohuo.flex.base.service.tenant.DefUserService;
import com.luohuo.flex.base.service.user.BaseEmployeeService;
import com.luohuo.flex.base.service.user.BaseOrgService;
import com.luohuo.flex.common.cache.common.CaptchaCacheKeyBuilder;
import com.luohuo.flex.common.properties.SystemProperties;
import com.luohuo.flex.oauth.service.UserInfoService;
import com.luohuo.flex.oauth.vo.param.RegisterByEmailVO;
import com.luohuo.flex.oauth.vo.param.RegisterByMobileVO;
import com.luohuo.flex.oauth.vo.result.OrgResultVO;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;

import static com.luohuo.basic.context.ContextConstants.*;

/**
 * @author tangyh
 * @version v1.0
 * @date 2022/9/16 12:21 PM
 * @create [2022/9/16 12:21 PM ] [tangyh] [初始创建]
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserInfoServiceImpl implements UserInfoService {
    /** 万能验证码 */
    private static final String MASTER_CAPTCHA = "888888";

    protected final BaseEmployeeService baseEmployeeService;
    protected final BaseOrgService baseOrgService;
    protected final DefUserService defUserService;
    protected final CacheOps cacheOps;
    protected final SystemProperties systemProperties;
    private final ImUserApi imUserApi;
    private final SaTokenConfig saTokenConfig;

    @Override
    public OrgResultVO findCompanyAndDept() {
        Long userId = ContextUtil.getUserId();
        Long companyId = ContextUtil.getCurrentCompanyId();
        Long deptId = ContextUtil.getCurrentDeptId();
        BaseEmployee baseEmployee = baseEmployeeService.getEmployeeByUser(userId);
        ArgumentAssert.notNull(baseEmployee, "用户不属于该企业");

        // 上次登录的单位
        List<BaseOrg> orgList = baseOrgService.findOrgByEmployeeId(baseEmployee.getId());

        Long currentCompanyId = companyId != null ? companyId : baseEmployee.getLastCompanyId();

        Long currentDeptId = deptId != null ? deptId : baseEmployee.getLastDeptId();
        return OrgResultVO.builder()
                .orgList(orgList)
                .employeeId(baseEmployee.getId())
                .currentCompanyId(currentCompanyId)
                .currentDeptId(currentDeptId).build();
    }

    @Override
    public List<BaseOrg> findDeptByCompany(Long companyId, Long employeeId) {
        return baseOrgService.findDeptByEmployeeId(employeeId, companyId);
    }

    @Override
    public String registerByMobile(RegisterByMobileVO register) {
        if (systemProperties.getVerifyCaptcha() && !MASTER_CAPTCHA.equals(register.getCode())) {
//            短信验证码
            CacheKey cacheKey = new CaptchaCacheKeyBuilder().key(register.getMobile(), register.getKey());
            CacheResult<String> code = cacheOps.get(cacheKey);
            ArgumentAssert.equals(code.getValue(), register.getCode(), "验证码不正确");
        } else if (MASTER_CAPTCHA.equals(register.getCode())) {
            log.info("使用万能验证码进行手机注册, mobile={}", register.getMobile());
        }
        ArgumentAssert.equals(register.getConfirmPassword(), register.getPassword(), "密码和确认密码不一致");
        DefUser defUser = BeanUtil.toBean(register, DefUser.class);

        defUserService.register(defUser);
        return defUser.getMobile();
    }

    @Override
    @Transactional
    public LoginResultVO registerByEmail(SysUser sysUser, RegisterByEmailVO register, String deviceType, String clientId) {
		// 1. 校验数据保存defUser
        if (systemProperties.getVerifyCaptcha() && !MASTER_CAPTCHA.equals(register.getCode())) {
            CacheKey cacheKey = new CaptchaCacheKeyBuilder().key(register.getEmail(), register.getKey());
            CacheResult<String> code = cacheOps.get(cacheKey);
            ArgumentAssert.equals(code.getValue(), register.getCode(), "验证码不正确");
        } else if (MASTER_CAPTCHA.equals(register.getCode())) {
            log.info("使用万能验证码进行邮箱注册, email={}", register.getEmail());
        }
        ArgumentAssert.equals(register.getConfirmPassword(), register.getPassword(), "密码和确认密码不一致");
        DefUser defUser = BeanUtil.toBean(register, DefUser.class);
		try {
			defUserService.registerByEmail(defUser);
		} catch (Exception e) {
			if(e.getMessage().contains("Duplicate")){
				throw new BizException("账号已存在！");
			}
		}

		// 2. 根据注册系统构造子系统需要的user参数，并获取uid
		Long uid = switch (LoginEnum.get(register.getSystemType())) {
			case IM -> {
				UserRegisterVo userRegisterVo = new UserRegisterVo();
				userRegisterVo.setAccount(defUser.getUsername());
				userRegisterVo.setEmail(register.getEmail());
				userRegisterVo.setUserId(defUser.getId());
				userRegisterVo.setName(defUser.getNickName());
				userRegisterVo.setSex(defUser.getSex());
				userRegisterVo.setAvatar(defUser.getAvatar());
				userRegisterVo.setTenantId(defUser.getTenantId());
				userRegisterVo.setUserType(UserTypeEnum.NORMAL.getValue());
				if(!imUserApi.register(userRegisterVo).getData()){
					throw new BizException("该邮箱已被其他账号绑定");
				}
				// 获取IM系统中的uid
				yield imUserApi.findById(defUser.getId(), defUser.getTenantId()).getData();
			}
			case MANAGER -> {
				// 2.1 注册后台管理员、RAM账号
				BaseEmployee baseEmployee = new BaseEmployee();
				baseEmployee.setName(defUser.getUsername());
				baseEmployee.setUserId(defUser.getId());
				// 用户注册时，默认主账号【不赋予特殊权限即可】
				baseEmployee.setUserType(1);
				baseEmployee.setParentId(0L);
				baseEmployee.setActiveStatus("20");
				baseEmployee.setPositionStatus("10");
				baseEmployee.setState(true);
				baseEmployee.setTenantId(defUser.getTenantId());
				BaseEmployee employee = baseEmployeeService.save(baseEmployee);

				// 2.2 关联默认组织
				BaseEmployeeOrgRelSaveVO employeeOrgRel = new BaseEmployeeOrgRelSaveVO();
				employeeOrgRel.setEmployeeId(employee.getId());
				employeeOrgRel.setOrgId(1L);	// 给一个默认的组织结构
				baseOrgService.saveEmployeeOrg(employeeOrgRel);

				// 2.3 关联默认角色
				BaseEmployeeRoleRelSaveVO employeeRoleRel = new BaseEmployeeRoleRelSaveVO();
				employeeRoleRel.setEmployeeId(employee.getId());
				employeeRoleRel.setRoleIdList(Arrays.asList(1460615729169563648L));	// 给一个默认的角色
				baseEmployeeService.saveEmployeeRole(employeeRoleRel);

				// 2.4 关联默认租户
				yield employee.getId();
			}
			default ->  {
				yield defUser.getId();
			}
		};

		// 3. 注册成功后自动登录
		LoginResultVO loginResult = autoLogin(defUser, uid, deviceType, clientId);
		log.info("用户注册成功并自动登录，邮箱：{}，账号：{}，uid：{}", defUser.getEmail(), defUser.getUsername(), uid);
		return loginResult;
    }

	/**
	 * 注册成功后自动登录
	 * @param defUser 用户信息
	 * @param uid 系统中的uid
	 * @param deviceType 设备类型
	 * @param clientId 客户端ID
	 * @return 登录结果
	 */
	private LoginResultVO autoLogin(DefUser defUser, Long uid, String deviceType, String clientId) {
		// 1. 组合设备类型
		String combinedDeviceType = ToolsUtil.combineStrings(defUser.getSystemType().toString(), deviceType);

		// 2. 执行登录
		String loginId = defUser.getId().toString();
		StpUtil.login(loginId, combinedDeviceType);

		// 3. 配置Session信息
		SaSession tokenSession = StpUtil.getTokenSession();
		tokenSession.setLoginId(defUser.getId());
		tokenSession.set(JWT_KEY_SYSTEM_TYPE, defUser.getSystemType());
		tokenSession.set(JWT_KEY_DEVICE, deviceType);
		tokenSession.set(CLIENT_ID, clientId);
		tokenSession.set(JWT_KEY_U_ID, uid);
		tokenSession.set(HEADER_TENANT_ID, defUser.getTenantId());

		// 4. 构建返回结果
		LoginResultVO resultVO = new LoginResultVO();
		resultVO.setToken(StpUtil.getTokenValue());
		resultVO.setClient(deviceType);
		resultVO.setExpire(Long.valueOf(StpUtil.getTokenTimeout()));
		resultVO.setUid(uid);

		// 5. 生成refreshToken
		JSONObject obj = new JSONObject();
		obj.set(JWT_KEY_USER_ID, defUser.getId());
		obj.set(JWT_KEY_U_ID, uid);
		obj.set(JWT_KEY_DEVICE, deviceType);
		obj.set(JWT_KEY_SYSTEM_TYPE, defUser.getSystemType());
		obj.set(HEADER_TENANT_ID, defUser.getTenantId());
		obj.set(CLIENT_ID, clientId);
		ContextUtil.setTenantId(defUser.getTenantId());
		resultVO.setRefreshToken(SaTempUtil.createToken(obj.toString(), 2 * saTokenConfig.getTimeout()));

		// 6. 发布登录事件
		defUser.refreshIp(ContextUtil.getIP());
		LoginStatusDTO loginStatus = LoginStatusDTO.success(defUser.getId(), uid, defUser.getSystemType(), deviceType);
		SpringUtils.publishEvent(new UserOnlineEvent(this, ContextUtil.getTenantId(), uid, defUser.getId(), defUser.getLastLoginTime(), defUser.getIpInfo()));
		SpringUtils.publishEvent(new LoginEvent(loginStatus));

		return resultVO;
	}

	@Override
	public Boolean checkEmail(String email) {
		// 1. 判断系统邮箱是否存在
		boolean systemEmail = defUserService.checkEmail(email, null);

		// 2. 判断Im邮箱是否存在
		boolean imEmail = imUserApi.checkEmail(email).getData();
		return systemEmail || imEmail;
	}
}
