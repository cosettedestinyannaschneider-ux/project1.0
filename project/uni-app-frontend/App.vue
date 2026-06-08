<script>
	export default {
		onLaunch: function() {
			console.log('App Launch')
		},
		onShow: function() {
			console.log('App Show')
		},
		onHide: function() {
			console.log('App Hide')
		}
	}
</script>

<style>
/* 每个页面的公共 css */
.container {
  padding: 20px;
  background-color: #f8f9fa;
  min-height: 100vh;
  box-sizing: border-box;
}

.card {
  background-color: #ffffff;
  padding: 20px;
  border-radius: 15px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  margin-bottom: 20px;
}

.section-title {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 15px;
  display: block;
}

.mini-btn {
  padding: 5px 10px;
  font-size: 12px;
  border-radius: 5px;
  line-height: 1.5;
}

.submit-btn {
  width: 100%;
  padding: 12px;
  border-radius: 10px;
  background-color: #0d6efd;
  color: white;
  font-weight: bold;
  text-align: center;
  border: none;
}
</style>
